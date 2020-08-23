export class LikeButton {
    constructor() {
        this.destination = 'https://asia-northeast1-likebutton-a2bc9.cloudfunctions.net/';
    }

    getPageInfo() {
        return fetch(this.destination + 'get', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                url: location.href,
            })
        }).then(r => r.json());
    }

    onLike() {
        return fetch(this.destination + 'increase', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                url: location.href,
            })
        }).then(r => r.json());
    }

    onUnLike() {
        return fetch(this.destination + 'decrease', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                url: location.href,
            })
        }).then(r => r.json());
    }

    async appendButtonTo(divElement) {
        divElement.append(await this.createButton());
    }

    async createButton() {
        const button = document.createElement('button');
        const currentData = await this.getPageInfo();

        // 微妙すぎ 共通化する
        if (currentData.isIncreased) {
            // 押されてた時
            button.setAttribute('pushed', 'pushed');
            button.innerText = `💗 ${currentData.likes}`;
        } else {
            button.setAttribute('pushed', '');
            button.innerText = `💙 ${currentData.likes}`;
        }

        let current = currentData.likes;
        button.addEventListener('click', () => {
            if (button.getAttribute('pushed')) {
                // 押されてた時
                button.setAttribute('pushed', '');
                current -= 1;
                button.innerText = `💙 ${current}`;
                this.onUnLike();
            } else {
                button.setAttribute('pushed', 'pushed');
                current += 1;
                button.innerText = `💗 ${currentData.likes + 1}`;
                this.onLike();
            }
        });

        return button;
    }
}
