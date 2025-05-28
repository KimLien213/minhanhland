// src/utils/toast.js
let toastRef = null;

export function setToastInstance(toast) {
    toastRef = toast;
}

export function showToast(options) {
    if (toastRef) {
        toastRef.add(options);
    }
}
