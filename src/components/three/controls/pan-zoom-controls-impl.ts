import { EventDispatcher, OrthographicCamera, Vector2, MOUSE, TOUCH } from "three";
import { getDataViewportFromFrustum, setFrustumFromDataViewport } from "../../../viewport-utils";

interface PanZoomControlsEventMap {
  change: object;
  start: object;
  end: object;
}

const _changeEvent = { type: "change" as const };
const _startEvent = { type: "start" as const };
const _endEvent = { type: "end" as const };

const STATE = {
  NONE: -1,
  PAN: 0,
  ZOOM: 1,
} as const;

type State = (typeof STATE)[keyof typeof STATE];

const EPS = 0.000001;

export class PanZoomControls extends EventDispatcher<PanZoomControlsEventMap> {
  object: OrthographicCamera;
  domElement: HTMLElement | undefined;

  // Set to false to disable this control
  enabled = true;

  // Set to false to disable panning
  enablePan = true;

  // Set to false to disable zooming
  enableZoom = true;

  // How fast to pan the camera when using keyboard or wheel
  panSpeed = 1.0;

  // How fast to zoom the camera
  zoomSpeed = 1.0;

  // Zoom constraints (relative to viewport width)
  minZoom = 0.1;
  maxZoom = 10;

  // Custom handler for viewport changes
  onViewportChange?: (frustum: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  }) => void;

  // Mouse buttons
  mouseButtons: Partial<{
    LEFT: MOUSE | null;
    MIDDLE: MOUSE | null;
    RIGHT: MOUSE | null;
  }> = {
    LEFT: null,
    MIDDLE: MOUSE.PAN,
    RIGHT: null,
  };

  // Touch fingers
  touches: Partial<{
    ONE: TOUCH | null;
    TWO: TOUCH | null;
  }> = {
    ONE: null,
    TWO: TOUCH.DOLLY_PAN,
  };

  // Internal state
  private state: State = STATE.NONE;
  private zoomStart = 0;
  private zoomEnd = 0;

  // Touch tracking
  private pointers: PointerEvent[] = [];
  private pointerPositions: Record<number, Vector2> = {};

  // Initial camera width for zoom constraints
  private initialCameraWidth: number;

  // Props for external scroll handling
  public scrollValue?: import("motion").MotionValue<number>;
  private _trackRegion?: { top: number; bottom: number };
  private _contentHeightPx?: number;
  public onMouseWheelOriginal?: (event: WheelEvent) => void;

  // Public getters and setters that clamp scroll bounds when changed
  public get trackRegion() {
    return this._trackRegion;
  }

  public set trackRegion(value: { top: number; bottom: number } | undefined) {
    this._trackRegion = value;
    this.clampScrollToBounds();
  }

  public get contentHeightPx() {
    return this._contentHeightPx;
  }

  public set contentHeightPx(value: number | undefined) {
    this._contentHeightPx = value;
    this.clampScrollToBounds();
  }

  // Resize observer for canvas dimension changes
  private resizeObserver?: ResizeObserver;

  // Optional callback for track-list vertical scroll
  public onListScroll?: (params: { scroll: number; min: number; max: number }) => void;

  // Bounds for left/right viewport
  bounds: [number, number] | undefined = undefined;

  constructor(object: OrthographicCamera, domElement?: HTMLElement) {
    super();

    this.object = object;
    this.domElement = domElement;

    // Store initial data viewport width for zoom constraints (always 1.0 for [0,1] range)
    // This should NOT use camera frustum width which includes padding
    this.initialCameraWidth = 1.0;

    // Connect to domElement if provided
    if (domElement) this.connect(domElement);
  }

  private onContextMenu = (event: globalThis.Event) => {
    if (!this.enabled) return;
    event.preventDefault();
  };

  private onPointerDown = (event: PointerEvent) => {
    if (!this.enabled) return;

    if (this.pointers.length === 0) {
      this.domElement?.setPointerCapture(event.pointerId);
      this.domElement?.addEventListener("pointermove", this.onPointerMove);
      this.domElement?.addEventListener("pointerup", this.onPointerUp);
    }

    this.addPointer(event);

    if (this.pointers.length === 2) {
      // Two fingers - check touch configuration
      if (this.touches.TWO === TOUCH.DOLLY_PAN && this.enableZoom) {
        this.state = STATE.ZOOM;

        const dx = this.pointers[0].pageX - this.pointers[1].pageX;
        const dy = this.pointers[0].pageY - this.pointers[1].pageY;
        this.zoomStart = Math.sqrt(dx * dx + dy * dy);

        this.dispatchEvent(_startEvent);
      }
    }
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.enabled) return;

    this.updatePointer(event);

    if (this.pointers.length === 2) {
      // Two finger zoom
      if (this.state === STATE.ZOOM && this.enableZoom) {
        this.handleTouchZoom();
      }
    }
  };

  private onPointerUp = (event: PointerEvent) => {
    this.removePointer(event);

    if (this.pointers.length === 0) {
      this.domElement?.releasePointerCapture(event.pointerId);
      this.domElement?.removeEventListener("pointermove", this.onPointerMove);
      this.domElement?.removeEventListener("pointerup", this.onPointerUp);
    }

    if (this.pointers.length < 2) {
      this.state = STATE.NONE;
      this.dispatchEvent(_endEvent);
    }
  };

  private onMouseWheel = (event: WheelEvent) => {
    if (!this.enabled) return;

    const rect = this.domElement?.getBoundingClientRect();
    const pointerY = rect ? event.clientY - rect.top : 0;
    const { top = 0, bottom = 0 } = this.trackRegion || {};
    const trackRegionStart = top;
    const trackRegionEnd = rect ? rect.height - bottom : 0;

    const absDeltaX = Math.abs(event.deltaX);
    const absDeltaY = Math.abs(event.deltaY);
    const threshold = 0.5; // Ignore tiny scrolls

    // Vertical scroll in track-list region, no ctrl/meta
    if (
      !event.ctrlKey &&
      !event.metaKey &&
      absDeltaY > absDeltaX &&
      absDeltaY > threshold &&
      pointerY >= trackRegionStart &&
      pointerY <= trackRegionEnd &&
      this.scrollValue &&
      typeof this._contentHeightPx === "number"
    ) {
      event.preventDefault();
      this.dispatchEvent(_startEvent);

      // Calculate scroll bounds
      const visibleHeightPx = rect ? rect.height - top - bottom : 0;
      const scrollMin = 0;
      const scrollMax = Math.max(0, this._contentHeightPx - visibleHeightPx);

      // If content fits available space (scrollMax is 0), don't update scroll
      if (scrollMax === 0) {
        this.dispatchEvent(_endEvent);
        return;
      }

      // Clamp scrollValue between min/max
      const prev = this.scrollValue.get();
      let next = prev + event.deltaY;
      next = Math.max(scrollMin, Math.min(scrollMax, next));
      this.scrollValue.set(next);

      // Call the onListScroll callback if present
      if (typeof this.onListScroll === "function") {
        this.onListScroll({ scroll: next, min: scrollMin, max: scrollMax });
      }

      this.dispatchEvent(_changeEvent);
      this.dispatchEvent(_endEvent);
      return;
    }

    event.preventDefault();
    this.dispatchEvent(_startEvent);

    // Zoom: Ctrl/Cmd + vertical scroll, and vertical is major axis
    if ((event.ctrlKey || event.metaKey) && absDeltaY > absDeltaX && absDeltaY > threshold) {
      if (!this.enableZoom) return;
      const baseZoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
      const zoomFactor = 1 + (baseZoomFactor - 1) * this.zoomSpeed;
      if (rect) {
        const center = new Vector2(event.clientX, event.clientY);
        this.zoomCameraHorizontal(zoomFactor, center);
      }
    }
    // Pan: horizontal scroll, and horizontal is major axis
    else if (this.enablePan && absDeltaX > absDeltaY && absDeltaX > threshold) {
      const panDelta = event.deltaX * this.panSpeed * 0.1;
      this.panCamera(panDelta);
    }
    // Otherwise, ignore
    else {
      return;
    }

    this.dispatchEvent(_changeEvent);
    this.dispatchEvent(_endEvent);
  };

  private addPointer(event: PointerEvent) {
    this.pointers.push(event);
  }

  private removePointer(event: PointerEvent) {
    const { [event.pointerId]: _, ...otherPositions } = this.pointerPositions;
    this.pointerPositions = otherPositions;

    for (let i = 0; i < this.pointers.length; i++) {
      if (this.pointers[i].pointerId === event.pointerId) {
        this.pointers.splice(i, 1);
        return;
      }
    }
  }

  private updatePointer(event: PointerEvent) {
    for (let i = 0; i < this.pointers.length; i++) {
      if (this.pointers[i].pointerId === event.pointerId) {
        this.pointers[i] = event;
        return;
      }
    }
  }

  private getTouchCenter(): Vector2 {
    const center = new Vector2();

    if (this.pointers.length >= 2) {
      center.x = (this.pointers[0].pageX + this.pointers[1].pageX) / 2;
      center.y = (this.pointers[0].pageY + this.pointers[1].pageY) / 2;
    }

    return center;
  }

  private handleTouchZoom() {
    if (!this.enableZoom) return;

    const dx = this.pointers[0].pageX - this.pointers[1].pageX;
    const dy = this.pointers[0].pageY - this.pointers[1].pageY;
    this.zoomEnd = Math.sqrt(dx * dx + dy * dy);

    if (this.zoomStart > 0) {
      const rawZoomFactor = this.zoomStart / this.zoomEnd;
      // Apply zoom speed and damping for better control
      const zoomFactor = 1 + (rawZoomFactor - 1) * this.zoomSpeed * 0.5;
      const center = this.getTouchCenter();
      this.zoomCameraHorizontal(zoomFactor, center);
      this.zoomStart = this.zoomEnd;
      this.dispatchEvent(_changeEvent);
    }
  }

  private panCamera(deltaX: number) {
    console.log("Panning axis");
    const camera = this.object;
    const canvasWidth = this.domElement?.clientWidth || 1;

    // Get current data viewport (without padding)
    const currentDataViewport = getDataViewportFromFrustum(
      { left: camera.left, right: camera.right },
      canvasWidth,
    );

    const dataWidth = currentDataViewport.right - currentDataViewport.left;
    const scale = (dataWidth / this.initialCameraWidth) * 0.25;
    const adjustedDeltaX = deltaX * scale;

    let newDataLeft = currentDataViewport.left + adjustedDeltaX;
    let newDataRight = currentDataViewport.right + adjustedDeltaX;

    // Apply bounds checking to DATA viewport, not camera frustum
    if (this.bounds) {
      const [min, max] = this.bounds;

      // If data viewport is wider than bounds, clamp to bounds
      if (dataWidth >= max - min) {
        newDataLeft = min;
        newDataRight = max;
      } else {
        // Clamp so data viewport stays within bounds
        if (newDataLeft < min) {
          newDataLeft = min;
          newDataRight = min + dataWidth;
        }
        if (newDataRight > max) {
          newDataRight = max;
          newDataLeft = max - dataWidth;
        }
      }
    }

    // Convert back to camera frustum with padding
    const newFrustum = setFrustumFromDataViewport(
      { left: newDataLeft, right: newDataRight },
      canvasWidth,
    );

    camera.left = newFrustum.left;
    camera.right = newFrustum.right;
    camera.updateProjectionMatrix();

    // Report the data viewport to external handlers
    this.onViewportChange?.({
      left: newDataLeft,
      right: newDataRight,
      top: camera.top,
      bottom: camera.bottom,
    });
  }

  private clampScrollToBounds() {
    // Only clamp if we have all required values
    if (!this.scrollValue || !this._trackRegion || typeof this._contentHeightPx !== "number") {
      return;
    }

    const rect = this.domElement?.getBoundingClientRect();
    if (!rect) return;

    const { top = 0, bottom = 0 } = this._trackRegion;
    const visibleHeightPx = rect.height - top - bottom;
    const scrollMin = 0;
    const scrollMax = Math.max(0, this._contentHeightPx - visibleHeightPx);

    const currentScroll = this.scrollValue.get();

    // Only clamp if scroll is actually out of bounds
    if (currentScroll < scrollMin || currentScroll > scrollMax) {
      const clampedScroll = Math.max(scrollMin, Math.min(scrollMax, currentScroll));
      this.scrollValue.set(clampedScroll);
    }
  }

  private zoomCameraHorizontal(zoomFactor: number, center: Vector2) {
    if (!this.enableZoom || !this.domElement) return;

    const camera = this.object;
    const rect = this.domElement.getBoundingClientRect();
    const canvasWidth = this.domElement.clientWidth;

    // Get current data viewport (without padding)
    const currentDataViewport = getDataViewportFromFrustum(
      { left: camera.left, right: camera.right },
      canvasWidth,
    );

    const currentDataWidth = currentDataViewport.right - currentDataViewport.left;

    // Calculate new width with zoom constraints based on initial data width
    const minDataWidth = this.initialCameraWidth / this.maxZoom;
    const maxDataWidth = this.initialCameraWidth / this.minZoom;
    const newDataWidth = Math.max(
      minDataWidth,
      Math.min(maxDataWidth, currentDataWidth / zoomFactor),
    );

    if (Math.abs(newDataWidth - currentDataWidth) < EPS) return;

    // Calculate zoom center in data space
    const relativeX = (center.x - rect.left) / rect.width;

    // Convert screen relative position to data viewport position
    const targetDataX = currentDataViewport.left + currentDataWidth * relativeX;
    const newDataCenterX = targetDataX - newDataWidth * (relativeX - 0.5);

    let newDataLeft = newDataCenterX - newDataWidth / 2;
    let newDataRight = newDataCenterX + newDataWidth / 2;

    // Apply bounds checking to DATA viewport
    if (this.bounds) {
      const [min, max] = this.bounds;

      if (newDataLeft < min) {
        newDataLeft = min;
        newDataRight = min + newDataWidth;
      }
      if (newDataRight > max) {
        newDataRight = max;
        newDataLeft = max - newDataWidth;
      }
      // If newDataWidth > bounds, clamp to bounds
      if (newDataRight - newDataLeft > max - min) {
        newDataLeft = min;
        newDataRight = max;
      }
    }

    // Convert to camera frustum with padding
    const newFrustum = setFrustumFromDataViewport(
      { left: newDataLeft, right: newDataRight },
      canvasWidth,
    );

    camera.left = newFrustum.left;
    camera.right = newFrustum.right;
    // Intentionally not modifying camera.top and camera.bottom for horizontal-only zoom

    camera.updateProjectionMatrix();

    // Report the data viewport to external handlers
    this.onViewportChange?.({
      left: newDataLeft,
      right: newDataRight,
      top: camera.top,
      bottom: camera.bottom,
    });
  }

  // Get current frustum for external components
  getFrustum() {
    const camera = this.object;
    return {
      left: camera.left,
      right: camera.right,
      top: camera.top,
      bottom: camera.bottom,
    };
  }

  update(): boolean {
    // Called by animation loop if needed
    return false;
  }

  connect(domElement: HTMLElement): void {
    this.domElement = domElement;
    // Disable touch scroll
    this.domElement.style.touchAction = "none";
    this.domElement.addEventListener("contextmenu", this.onContextMenu);
    this.domElement.addEventListener("pointerdown", this.onPointerDown);
    this.domElement.addEventListener("pointercancel", this.onPointerUp);
    this.domElement.addEventListener("wheel", this.onMouseWheel);

    // Set up resize observer to clamp scroll bounds when canvas dimensions change
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => {
        // Use a small delay to ensure DOM has updated
        setTimeout(() => {
          this.clampScrollToBounds();
        }, 0);
      });
      this.resizeObserver.observe(domElement);
    }
  }

  dispose(): void {
    if (this.domElement) {
      this.domElement.style.touchAction = "auto";
      this.domElement.removeEventListener("contextmenu", this.onContextMenu);
      this.domElement.removeEventListener("pointerdown", this.onPointerDown);
      this.domElement.removeEventListener("pointercancel", this.onPointerUp);
      this.domElement.removeEventListener("wheel", this.onMouseWheel);
    }

    // Clean up resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }

    // Clean up pointer tracking
    this.pointers.length = 0;
    this.pointerPositions = {};
  }
}
