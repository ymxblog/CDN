// likeme.js 源码修改 - 包含首次加载延迟重试机制
const likeMe = (() => {
    let instance; // 用于存储 LikeMeSingleton 的唯一实例
    let initialCallOptions = null; // 用于存储首次调用的 options
    let retryCount = 0;
    const MAX_RETRIES = 20; // 最大重试次数，50ms一次，总共1秒等待
    const RETRY_INTERVAL = 50; // 重试间隔（毫秒）

    // 辅助函数：尝试查找目标元素并创建/初始化实例
    function tryInitializeInstance(options) {
        const targetElement = document.querySelector(options.el);

        if (targetElement) {
            // 元素已找到，进行初始化
            console.log('LikeMe: Target element found. Initializing instance.');
            instance = new LikeMeSingleton(options); // 创建新实例
            instance.reinitialize(options.el); // 进行首次初始化
            initialCallOptions = null; // 清除首次调用选项
            retryCount = 0; // 重置重试计数
        } else if (retryCount < MAX_RETRIES) {
            // 元素未找到，但未达最大重试次数，延迟后重试
            console.warn(`LikeMe: Target element ${options.el} not found yet. Retrying in ${RETRY_INTERVAL}ms (attempt ${retryCount + 1}/${MAX_RETRIES}).`);
            retryCount++;
            setTimeout(() => tryInitializeInstance(options), RETRY_INTERVAL);
        } else {
            // 达到最大重试次数，仍未找到元素，初始化失败
            console.error(`LikeMe: Target element ${options.el} not found after ${MAX_RETRIES} retries. Initialization failed.`);
            initialCallOptions = null; // 清除首次调用选项
            retryCount = 0; // 重置重试计数
        }
    }

    // likeMe 函数：外部调用的接口
    return options => {
        if (!instance) {
            // 第一次调用 likeMe()，实例尚未创建
            if (!initialCallOptions) { // 只存储第一次的 options
                initialCallOptions = options;
            }
            // 启动延迟初始化机制，而不是立即创建实例
            console.log('LikeMe: First call detected. Starting deferred initialization.');
            tryInitializeInstance(initialCallOptions); // 总是使用首次调用的 options
        } else {
            // 实例已存在（通常是 PJAX 导航后的调用）
            console.log('LikeMe: Instance already exists. Reinitializing for new page.');
            // 更新实例的配置
            instance.url = options.serverURL || instance.url;
            instance.color = options.color || instance.color;
            // 强制重新初始化到新的目标元素
            instance.reinitialize(options.el);
        }
        // 首次调用时，由于实例是延迟创建的，这里可能返回 undefined。
        // 但后续 PJAX 导航时，实例已存在，会返回正确的实例。
        // 外部 PJAX 脚本不应该依赖首次调用 likeMe() 的返回值。
        return instance;
    };
})();

class LikeMeSingleton {
    constructor({ el, serverURL, color = '#ff9797' }) {
        Object.assign(this, { el, url: serverURL, color });
        this.isLiking = false;
        // 构造函数不执行初始化，初始化职责完全交给 reinitialize 方法
    }

    // reinitialize 方法：用于（重新）初始化组件
    async reinitialize(newEl = this.el) {
        // 1. 更新实例的目标元素。这是关键，确保操作的是当前页面的DOM
        this.el = newEl;

        // 2. 清空目标元素的内容，为新的渲染做准备
        const currentElement = document.querySelector(this.el);
        if (currentElement) {
            currentElement.innerHTML = ''; // 清空目标元素的HTML内容
        } else {
            console.warn(`LikeMe target element ${this.el} not found during reinitialization. Skipping render.`);
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

    // init 方法：保持兼容性，让它调用 reinitialize
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
