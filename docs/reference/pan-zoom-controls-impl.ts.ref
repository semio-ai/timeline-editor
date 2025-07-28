import {
  EventDispatcher,
  OrthographicCamera,
  Vector2,
  MOUSE,
  TOUCH,
} from "three";

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
  private pointerPositions: { [key: number]: Vector2 } = {};

  // Initial camera width for zoom constraints
  private initialCameraWidth: number;

  constructor(object: OrthographicCamera, domElement?: HTMLElement) {
    super();

    this.object = object;
    this.domElement = domElement;

    // Store initial camera width for zoom constraints
    this.initialCameraWidth = this.object.right - this.object.left;

    // Connect to domElement if provided
    if (domElement) this.connect(domElement);
  }

  private onContextMenu = (event: globalThis.Event) => {
    if (this.enabled === false) return;
    event.preventDefault();
  };

  private onPointerDown = (event: PointerEvent) => {
    if (this.enabled === false) return;

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
    if (this.enabled === false) return;

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
    if (this.enabled === false) return;

    // Always prevent default to avoid page scrolling
    event.preventDefault();

    this.dispatchEvent(_startEvent);

    // Check for CTRL/CMD + vertical scroll for zoom
    if ((event.ctrlKey || event.metaKey) && Math.abs(event.deltaY) > 0) {
      if (!this.enableZoom) return;

      // Zoom to cursor position with zoomSpeed applied (invert direction for intuitive behavior)
      const baseZoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
      const zoomFactor = 1 + (baseZoomFactor - 1) * this.zoomSpeed;
      const rect = this.domElement?.getBoundingClientRect();
      if (rect) {
        const center = new Vector2(event.clientX, event.clientY);
        this.zoomCameraHorizontal(zoomFactor, center);
      }
    } else if (this.enablePan && Math.abs(event.deltaX) > 0) {
      // Horizontal panning only when no modifier keys
      const panDelta = event.deltaX * this.panSpeed * 0.1;
      this.panCamera(panDelta);
    } else {
      // No action taken, don't dispatch events
      return;
    }

    this.dispatchEvent(_changeEvent);
    this.dispatchEvent(_endEvent);
  };

  private addPointer(event: PointerEvent) {
    this.pointers.push(event);
  }

  private removePointer(event: PointerEvent) {
    delete this.pointerPositions[event.pointerId];

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
    if (this.enableZoom === false) return;

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
    const camera = this.object;

    // Pan by adjusting frustum (horizontal only for wheel)
    camera.left += deltaX;
    camera.right += deltaX;
    // Note: Not affecting top/bottom for horizontal-only panning

    camera.updateProjectionMatrix();
  }

  private zoomCameraHorizontal(zoomFactor: number, center: Vector2) {
    if (!this.enableZoom || !this.domElement) return;

    const camera = this.object;
    const rect = this.domElement.getBoundingClientRect();

    // Convert screen coordinates to relative position
    const relativeX = (center.x - rect.left) / rect.width;

    const currentWidth = camera.right - camera.left;

    // Calculate new width with zoom constraints based on initial camera width
    // minZoom and maxZoom are scale factors (e.g., 0.1 = 10% of original, 10 = 1000% of original)
    const minWidth = this.initialCameraWidth / this.maxZoom; // maxZoom means smaller width
    const maxWidth = this.initialCameraWidth / this.minZoom; // minZoom means larger width

    const newWidth = Math.max(
      minWidth,
      Math.min(maxWidth, currentWidth / zoomFactor),
    );

    if (Math.abs(newWidth - currentWidth) < EPS) return;

    // Zoom to point (horizontal only - keep vertical frustum unchanged)
    const targetWorldX = camera.left + currentWidth * relativeX;
    const newHalfWidth = newWidth / 2;
    const newCenterX = targetWorldX - newWidth * (relativeX - 0.5);

    camera.left = newCenterX - newHalfWidth;
    camera.right = newCenterX + newHalfWidth;
    // Intentionally not modifying camera.top and camera.bottom for horizontal-only zoom

    camera.updateProjectionMatrix();
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

    // Handle viewport resize - DISABLED FOR STABLE CAMERA APPROACH
  }

  dispose(): void {
    if (this.domElement) {
      this.domElement.style.touchAction = "auto";
      this.domElement.removeEventListener("contextmenu", this.onContextMenu);
      this.domElement.removeEventListener("pointerdown", this.onPointerDown);
      this.domElement.removeEventListener("pointercancel", this.onPointerUp);
      this.domElement.removeEventListener("wheel", this.onMouseWheel);
    }

    // Window resize listener not used with stable camera approach

    // Clean up pointer tracking
    this.pointers.length = 0;
    this.pointerPositions = {};
  }
}
