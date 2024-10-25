var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function getToken(name) {
    let cookieValue = '';
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}
let currentController = null;
function ajax(url_1, data_1) {
    return __awaiter(this, arguments, void 0, function* (url, data, abort = false) {
        const controller = new AbortController();
        if (currentController && abort) {
            currentController.abort();
        }
        currentController = controller;
        try {
            const response = yield fetch(url, {
                method: 'POST',
                mode: 'cors',
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': getToken('csrftoken'),
                    'X-Debug-Toolbar-Request': 'true',
                },
                body: JSON.stringify(data),
                signal: controller.signal,
            });
            return yield response.json();
        }
        catch (error) {
            console.log('error:', error);
        }
    });
}
export { ajax, getToken };
