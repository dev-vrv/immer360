class ParserHandle {
    private _url: string;
    private _csrf: string;
    private _form: HTMLFormElement;
    private _button: HTMLButtonElement;
    private _pathList: { [key: string]: string };
    private _stoneLink: HTMLLinkElement;
    constructor() {
        this._url = document.getElementById('api')?.getAttribute('value') as string;
        this._csrf = this.getCookie('csrftoken') as string;

        this._stoneLink = document.getElementById('stone-link') as HTMLLinkElement;
        this._form = document.getElementById('parse-form') as HTMLFormElement;
        this._button = this._form.querySelector('button[type="submit"]') as HTMLButtonElement;

        this._pathList = {
            'parse': `${this._url}/v360/parse/handle/`,
            'get': `${this._url}/v360/get/`,
        }
    }


    loadingView(loading: boolean) {
        if (loading) {
            this._button.disabled = true;
            this._button.innerHTML = 'Parsing...';
        } else {
            this._button.disabled = false;
            this._button.innerHTML = 'Parse';
        }
    }

    linkView(disabled:boolean, link: string) {
        if (disabled) {
            this._stoneLink.classList.add('disabled');
            this._stoneLink.setAttribute('href', '#');
        }
        else {
            this._stoneLink.classList.remove('disabled');
            this._stoneLink.setAttribute('href', link);
        }
    }

    alertView(message: string, type: string) {
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
       this._form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            this.loadingView(true);
            this.linkView(true, '');
            const url = this._form.querySelector('#url') as HTMLInputElement;
            const certificate = this._form.querySelector('#certificate') as HTMLInputElement;
            try {
                const response = fetch(`${this._pathList['parse']}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this._csrf as string
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        'certificate': certificate.value,
                        'url': url.value,
                        'model': 'white',
                    }),
                });
                const data = await response.then((response) => response.json());
                if (data.status === 'success') {
                    this.alertView('Parse success', 'success');
                    this.linkView(false, `${this._pathList['get']}${certificate.value}`);
                }
                else {
                    this.loadingView(false);
                    this.alertView(data.message, 'danger');
                }
            } catch (error) {
                this.loadingView(false);
                this.alertView('Parse error', 'danger');
            }
            finally {
                this.loadingView(false);
            }

        });
    }


    getCookie(name: string): string | null {
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