function getToken(name: string): string {
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

let currentController: any = null;

async function ajax(url: string, data?: any, abort: boolean = false) {
    const controller = new AbortController();
    if (currentController && abort) {
        currentController.abort();
    }
    currentController = controller;

    try {
        const response = await fetch(url, {
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

        return await response.json();




    } catch (error) {
        console.log('error:', error);
    }
}

export { ajax, getToken };