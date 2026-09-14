export const emitted = [];
export const emit = (t, d) => emitted.push([t, d]);
export const on = () => () => {};
