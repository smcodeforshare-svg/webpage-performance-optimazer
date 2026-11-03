/**
 * Sample jQuery and JavaScript Application with Common Bottlenecks
 */

$(document).ready(function() {
    // Bottleneck 1: Unthrottled scroll event listener
    $(window).on('scroll', function() {
        var scrollTop = $(window).scrollTop();
        if (scrollTop > 200) {
            $('#backToTop').show();
        }
    });

    // Bottleneck 2: Missing event delegation on dynamic list items
    $('.card-btn').on('click', function(e) {
        var id = $(this).data('id');
        console.log('Clicked card', id);
    });

    // Bottleneck 3: Synchronous AJAX request (freezes UI)
    function loadConfigSync() {
        var result = null;
        $.ajax({
            url: '/api/config',
            async: false,
            success: function(data) {
                result = data;
            }
        });
        return result;
    }

    // Bottleneck 4: Repeated jQuery selector inside loop
    function updateBadgeCounts(items) {
        for (var i = 0; i < items.length; i++) {
            $('.cart-badge').text(items.length);
        }
    }

    // Bottleneck 5: Inefficient innerHTML += inside loop
    function renderListItems(container, items) {
        for (var j = 0; j < items.length; j++) {
            container.innerHTML += '<li>' + items[j].title + '</li>';
        }
    }
});
