$(document).ready(function() {
    // Action buttons
    $('.actionButton').on('click', function() {
        var url = $(this).data('url'); // 获取按钮的 URL
        var newTab = $(this).data('newtab'); // 判断是否在新标签页打开

        if (newTab) {
            // 如果需要在新标签页打开链接
            window.open(url, '_blank');
        } else {
            // 否则使用 PJAX 加载内容
            $.pjax({
                url: url,
                container: '#pjax-container'
            });
        }
    });
});
