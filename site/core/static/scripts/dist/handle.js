"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
class ParserHandle {
    constructor() {
        var _a;
        this._url = (_a = document.getElementById('api')) === null || _a === void 0 ? void 0 : _a.getAttribute('value');
        this._csrf = this.getCookie('csrftoken');
        this._stoneLink = document.getElementById('stone-link');
        this._form = document.getElementById('parse-form');
        this._button = this._form.querySelector('button[type="submit"]');
        this._pathList = {
            'parse': `${this._url}/v360/parse/handle/`,
            'get': `${this._url}/v360/get/`,
        };
    }
    loadingView(loading) {
        if (loading) {
            this._button.disabled = true;
            this._button.innerHTML = 'Parsing...';
        }
        else {
            this._button.disabled = false;
            this._button.innerHTML = 'Parse';
        }
    }
    linkView(disabled, link) {
        if (disabled) {
            this._stoneLink.classList.add('disabled');
            this._stoneLink.setAttribute('href', '#');
        }
        else {
            this._stoneLink.classList.remove('disabled');
            this._stoneLink.setAttribute('href', link);
        }
    }
    alertView(message, type) {
        const alert = document.createElement('div');
        alert.classList.add('alert', `alert-${type}`, 'alert-dismissible', 'fade', 'show', 'm-0');
        alert.setAttribute('role', 'alert');
        alert.innerHTML = message;
        this._form.insertAdjacentElement('afterbegin', alert);
        setTimeout(() => {
            alert.remove();
        }, 5000);
    }
    formHandler() {
        var _a;
        (_a = this._form) === null || _a === void 0 ? void 0 : _a.addEventListener('submit', (e) => __awaiter(this, void 0, void 0, function* () {
            e.preventDefault();
            this.loadingView(true);
            this.linkView(true, '');
            const url = this._form.querySelector('#url');
            const certificate = this._form.querySelector('#certificate');
            try {
                const response = fetch(`${this._pathList['parse']}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this._csrf
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        'certificate': certificate.value,
                        'url': url.value,
                        'model': 'white',
                    }),
                });
                const data = yield response.then((response) => response.json());
                if (data.status === 'success') {
                    this.alertView('Parse success', 'success');
                    this.linkView(false, `${this._pathList['get']}${certificate.value}`);
                }
                else {
                    this.loadingView(false);
                    this.alertView(data.message, 'danger');
                }
            }
            catch (error) {
                this.loadingView(false);
                this.alertView('Parse error', 'danger');
            }
            finally {
                this.loadingView(false);
            }
        }));
    }
    getCookie(name) {
        let cookieValue = null;
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
}
document.addEventListener('DOMContentLoaded', () => {
    const parser = new ParserHandle();
    parser.formHandler();
});
