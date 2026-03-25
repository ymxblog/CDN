// likeme.js 源码修改
const likeMe = (() => {
    let instance; // 用于存储 LikeMeSingleton 的唯一实例

    return options => {
        // 如果实例不存在，则创建新实例
        if (!instance) {
            instance = new LikeMeSingleton(options);
            // 首次创建时，立即调用其初始化逻辑
            instance.reinitialize(options.el); // 使用 reinitialize 进行首次初始化
        } else {
            // 如果实例已存在，则更新其配置，并强制重新初始化
            // 确保每次调用 likeMe() 时，实例的配置和目标元素都得到更新
            instance.url = options.serverURL || instance.url; // 更新服务器URL
            instance.color = options.color || instance.color; // 更新颜色
            instance.reinitialize(options.el); // 强制重新初始化到新的目标元素
        }
        return instance; // 返回唯一的实例
    };
})();

class LikeMeSingleton {
    constructor({ el, serverURL, color = '#ff9797' }) {
        Object.assign(this, { el, url: serverURL, color });
        this.isLiking = false;
        // 注意：构造函数这里不再立即调用 this.init() 或其它初始化方法
        // 初始化的职责完全交给 likeMe 函数内部的 reinitialize 调用
    }

    // 新增的 reinitialize 方法，用于（重新）初始化组件
    async reinitialize(newEl = this.el) {
        // 1. 更新实例的目标元素。这是关键，确保操作的是当前页面的DOM
        this.el = newEl;

        // 2. 清空目标元素的内容，为新的渲染做准备
        // 防止旧的点赞组件内容残留，或者确保新的模板能被完整插入
        const currentElement = document.querySelector(this.el);
        if (currentElement) {
            currentElement.innerHTML = ''; // 清空目标元素的HTML内容
        } else {
            console.warn(`LikeMe target element ${this.el} not found. Skipping reinitialization.`);
            return; // 如果目标元素不存在，则没有必要继续渲染
        }

        // 3. 执行核心初始化逻辑：渲染UI、绑定事件、更新计数
        try {
            await this.renderUI();
            this.attachEvents();
            this.updateCount();
        } catch (error) {
            console.error('LikeMe reinitialize error:', error);
        }
    }

    // 保持原来的 init 方法，但让它调用 reinitialize。
    // 这样如果外部有地方直接调用了 init，也能通过 reinitialize 路由
    async init() {
        return this.reinitialize(this.el);
    }

    // 以下是 LikeMeSingleton 的其他方法，保持不变

    async renderUI() {
        try {
            const response = await fetch(this.url);
            const html = await response.text();
            const element = document.querySelector(this.el);
            if (element) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                element.innerHTML = doc.body.innerHTML;
                const card = element.querySelector('.likeCard');
                if (card) {
                    card.style.setProperty('background-color', this.color);
                }
            }
        } catch (error) {
            console.error('Render UI error:', error);
        }
    }

    attachEvents() {
        const card = document.querySelector(`${this.el} .likeCard`);
        if (card) {
            card.addEventListener('click', () => this.handleLike());
        }
    }

    async updateCount() {
        try {
            const response = await fetch(`${this.url}/info`);
            const data = await response.json().catch(() => null);
            if (response.ok && data) {
                const count = data.data?.count || 0;
                const textElement = document.querySelector(`${this.el} .likeCard-text`);
                if (textElement) {
                    textElement.textContent = `❤ ${count}`;
                }
            }
        } catch (error) {
            console.error('Update count error:', error);
        }
    }

    setUIState(isLoading, text, isSuccess = false) {
        const card = document.querySelector(`${this.el} .likeCard`);
        const textElement = document.querySelector(`${this.el} .likeCard-text`);
        if (card && textElement) {
            card.classList.remove('loading', 'success');
            if (isLoading) {
                card.classList.add('loading');
            } else if (isSuccess) {
                card.classList.add('success');
            }
            textElement.textContent = text;
        }
    }

    async handleLike() {
        if (this.isLiking) return;
        this.isLiking = true;
        this.setUIState(true, '❤ 爱意传递中...');
        try {
            const response = await fetch(`${this.url}/like`);
            const payload = await response.json().catch(() => null);
            if (!payload) {
                this.setUIState(false, '❤ 网络错误');
                setTimeout(() => { this.updateCount(); }, 1500);
                return;
            }
            const { code, data = {}, msg } = payload;
            const count = data.count || 0;
            if (response.ok && code === '200') {
                this.setUIState(false, '❤ 传递成功~', true);
                setTimeout(() => { this.setUIState(false, `❤ ${count}`); }, 500);
                return;
            }
            this.setUIState(false, msg || '❤ 传递失败~');
            setTimeout(() => { this.updateCount(); }, 1500);
        } catch (error) {
            console.error('Handle like error:', error);
            this.setUIState(false, '❤ 网络错误');
            setTimeout(() => { this.updateCount(); }, 1500);
        } finally {
            this.isLiking = false;
        }
    }
}
