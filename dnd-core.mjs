/**
 * Thin abstraction layer for custom HTML dnd.
 * @link https://github.com/dsimushkin/html-dnd-js
 * @version 1.0.0
 */

/**
 * @typedef {Object} State
 * @property {any} props draggable id mechanism and user data if needed.
 * @property {number} dx X-axis shift
 * @property {number} dy Y-axis shift
 * @property {bool} canceled indicator flag
 *
 * @typedef {Object} Config
 * @property {number|undefined} delay delay in ms after the initial
 * pointerdown event before the target is considered dragged.
 * @property {number|undefined} detach (default 2) movement 
 * threshold after the initial pointerdown event when the target
 * is considered dragged.
 */

/** @type State */
export const state = {
    props: null,
    dx: 0,
    dy: 0,
    canceled: false,
};

/**
 * Dnd observer. To attach to HTML events use {@link init} method.
 *
 * There are 2 types of events:
 *
 * - `dnd-drag`. a target on which a pointer down event occured
 *   becomes dragged/detached either after a configured `delay`
 *   or if the user moves a target by a small margin
 *   (threshold is configurable).
 *
 * - `dnd-drop` with a `canceled` flag. Side-effects
 *   (i.e. persisting `new` position) should only be called if
 *   `canceled` is false.
 *
 */
export const observer = new EventTarget();

/** 
 * Attach required HTML listeners.
 * @returns {() => void} destructor
 */
export function init() {
    window.addEventListener("mousemove", move, true);
    window.addEventListener("mouseup", drop);
    window.addEventListener("touchmove", move, false);
    window.addEventListener("touchend", drop);
    window.addEventListener("contextmenu", cancel);
    window.addEventListener("touchcancel", cancel);
    // second touch interruptor
    window.addEventListener("touchstart", cancel, { capture: true });
    return () => {
        window.removeEventListener("mousemove", move, true);
        window.removeEventListener("mouseup", drop);
        window.removeEventListener("touchmove", move, false);
        window.removeEventListener("touchend", drop);
        window.removeEventListener("touchstart", cancel);
    };
}

/**
 */

/**
 * @param {any} props - draggable id container.
 * @param {Element} element - drag handle or the draggable itself.
 * @param {Config|undefined} config
 *
 * @returns {() => void} destructor
 */
export function draggable(props, element, config) {
    const delay = config.delay ?? 50;
    detach = config.detach ?? detach;
    const fn = start.bind(null, props, delay);
    element.addEventListener("mousedown", fn);
    element.addEventListener("touchstart", fn);
    return () => {
        element.removeEventListener("mousedown", fn);
        element.removeEventListener("touchstart", fn);
    };
}

// private section start
const current = { x: undefined, y: undefined };
const initial = { x: undefined, y: undefined };
let defer = null;
let detach = 2;

function cancel() {
    if (state.props == null) return;
    state.canceled = true;
    try {
        dispatch("dnd-drop");
    } finally {
        cleanup();
    }
}

function start(props, delay, e) {
    if (state.props != null) return cancel();
    // prevent selection + scroll due to selection
    toggleUserSelect();
    state.props = props;
    fill(initial, e);
    defer = setTimeout(() => {
        defer = null;
        move(e);
    }, delay);
}


function move(e) {
    if (state.props == null) return;
    // prevent touch device scroll. there might not be TouchEvent
    if (!(e instanceof MouseEvent)) e.preventDefault();
    fill(current, e);
    state.dx = current.x - initial.x;
    state.dy = current.y - initial.y;
    if (defer != null) {
        if (state.dx + state.dy < detach) return;
        clearTimeout(defer);
        defer = null;
    }
    dispatch("dnd-drag");
}

function drop() {
    if (state.props == null) return;
    try {
        if (defer == null) dispatch("dnd-drop");
    } finally {
        cleanup();
    }
}

function cleanup() {
    if (state.props == null) return;
    toggleUserSelect();
    state.props = null;
    state.dx = state.dy = 0;
    state.canceled = false;
    clearTimeout(defer);
    defer = null;
    initial.x = initial.y = undefined;
    current.x = current.y = undefined;
    detach = 2;
}

function getPointer(e) {
    if (e == null) return undefined;
    if (e instanceof MouseEvent) return e;
    return e.touches?.length ? e.touches[0] : e.changedTouches[0];
}

let style = {
    webkitUserSelect: "none",
    MozUserSelect:    "none",
    msUserSelect:     "none",
    userSelect:       "none",
};

function toggleUserSelect() {
    const body = document.body;
    const tmp = {};
    // keep loops separate. body.style variables are aliases.
    for (const key in style) tmp[key] = body.style[key];
    for (const key in style) body.style[key] = style[key];
    style = tmp;
}

function fill(s, e) {
    const p = getPointer(e);
    s.x = p?.clientX;
    s.y = p?.clientY;
}

function dispatch(type) {
    observer.dispatchEvent(new CustomEvent(type, { detail: state }));
}
