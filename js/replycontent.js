(function() {
    let walineContainer = null;
    let observer = null;

    const initWalineReply = () => {
        // 移除旧的事件监听器
        if (walineContainer) {
            walineContainer.removeEventListener('click', handleClick);
        }

        // 获取新的评论容器
        walineContainer = document.getElementById('waline-wrap');
        
        if (!walineContainer) {
            return; // 如果没有找到容器则退出
        }

        // 添加点击事件监听器
        walineContainer.addEventListener('click', handleClick, { passive: true });

        // 如果旧观察者存在，则断开连接
        if (observer) {
            observer.disconnect();
        }

        // 创建新的 MutationObserver 实例并开始观察
        observer = new MutationObserver(() => {
            // 在 DOM 变化时重新初始化
            initWalineReply();
        });

        observer.observe(walineContainer, {
            childList: true,
            subtree: true
        });
    };

    const handleClick = (e) => {
        const replyBtn = e.target.closest('button.wl-reply');
        if (!replyBtn || walineContainer.dataset.pjaxLoading === 'true') return;

        // 精准定位当前评论内容
        const commentItem = replyBtn.closest('.wl-card-item');
        const contentNode = commentItem.querySelector('.wl-card > .wl-content');

        if (!contentNode) {
            return;
        }

        // 沙盒处理（保留链接结构）
        const sandbox = contentNode.cloneNode(true);
        
        // 移除干扰元素
        sandbox.querySelectorAll(
            'span, .wl-meta, svg, img, .wl-quote, blockquote, a[href^="#"], pre'
        ).forEach(n => n.remove());

        // 转换普通链接为Markdown格式（保留非锚点链接）
        sandbox.querySelectorAll('a:not([href^="#"])').forEach(a => {
            const text = a.textContent.trim();
            const href = a.getAttribute('href') || '';
            a.replaceWith(`[${text}](${href})`);
        });

        // 提取纯净文本（增加过滤@符号）
        const pureText = sandbox.textContent
            .replace(/@\S+/g, '')               // 新增@提及过滤
            .replace(/\n{3,}/g, '\n\n')
            .trim()
            .substring(0, 500);

        // 获取编辑器实例
        const editor = walineContainer.querySelector('.wl-editor');
        if (!editor) {
            return;
        }

        // 执行插入
        insertEditorContent(editor, pureText);
    };

    // 通用插入方法（支持Markdown）
    const insertEditorContent = (editor, text) => {
        const insertText = `> ${text}\n\n`;
        const inputEvent = new Event('input', { bubbles: true });

        if (editor.tagName === 'TEXTAREA' || editor.tagName === 'INPUT') {
            // 原生文本域处理
            const start = editor.selectionStart;
            editor.value = 
                editor.value.slice(0, start) + 
                insertText + 
                editor.value.slice(editor.selectionEnd);
            editor.selectionEnd = start + insertText.length;
        } else if (editor.isContentEditable) {
            // 富文本编辑器处理
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(editor);
            range.collapse(false); // 光标移到最后
            range.insertNode(document.createTextNode(insertText));
            selection.removeAllRanges();
            selection.addRange(range);
        }

        editor.dispatchEvent(inputEvent);
        editor.focus();
    };

    // 初始化及事件监听
    document.addEventListener('pjax:complete', initWalineReply);
    initWalineReply(); // 初次调用以进行初始化
})();

(function() { // 使用立即执行函数表达式 (IIFE) 封装，避免全局污染

    /**
     * 处理单个 emoji 图片，将 alt 属性值赋给 title 属性。
     * @param {HTMLImageElement} img - 要处理的 img 元素。
     */
    function processEmojiImage(img) {
        // 只有当图片还没有 title 属性时才进行设置，避免重复处理或覆盖手动设置的 title
        if (!img.hasAttribute('title')) {
            const altText = img.getAttribute('alt');
            if (altText && altText.trim() !== '') {
                img.setAttribute('title', altText);
                // console.log(`[Emoji Title] 图片 ${img.src || '无src'} 的title已设置为: "${altText}"`); // 调试信息
            } else {
                // console.warn(`[Emoji Title] 图片 ${img.src || '无src'} 有 class="wl-emoji" 但 alt 属性为空或缺失，未设置title。`); // 调试信息
            }
        }
    }

    /**
     * 查找并处理页面中所有 class 包含 'wl-emoji' 的 img 标签。
     * @param {HTMLElement} [scope=document] - 查找范围，默认为整个文档。
     */
    function processAllEmojiImages(scope = document) {
        const emojiImages = scope.querySelectorAll('img.wl-emoji');
        emojiImages.forEach(processEmojiImage);
    }

    // 1. 在 DOM 内容加载完成后，首先处理所有当前已存在的 emoji 图片
    document.addEventListener('DOMContentLoaded', function() {
        processAllEmojiImages();
        // console.log('[Emoji Title] Initial scan and update completed.'); // 调试信息
    });

    // 2. 设置 MutationObserver 监听 DOM 变化，处理动态添加的 emoji 图片
    const observer = new MutationObserver(function(mutationsList) {
        for (const mutation of mutationsList) {
            // 检查是否有子节点被添加
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    // 只处理元素节点
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // 如果添加的节点本身就是 emoji 图片
                        if (node.matches && node.matches('img.wl-emoji')) {
                            processEmojiImage(node);
                        }
                        // 如果添加的节点包含 emoji 图片（例如，添加了一个 div，div 里面有 img.wl-emoji）
                        processAllEmojiImages(node);
                    }
                });
            }
            // 也可以监听属性变化，如果 alt 属性是动态设置的
            // else if (mutation.type === 'attributes' && mutation.attributeName === 'alt') {
            //     if (mutation.target.matches && mutation.target.matches('img.wl-emoji')) {
            //         processEmojiImage(mutation.target);
            //     }
            // }
        }
    });

    // 配置 observer 监听整个文档的子节点变化和属性变化
    observer.observe(document.body, {
        childList: true, // 监听子节点的添加或移除
        subtree: true,   // 监听所有后代节点的子节点变化
        // attributes: true, // 如果 alt 属性是动态添加或修改的，也需要监听属性变化
        // attributeFilter: ['alt', 'class'] // 如果监听属性，可以指定只监听 alt 和 class 属性
    });

    // console.log('[Emoji Title] MutationObserver started.'); // 调试信息

})();