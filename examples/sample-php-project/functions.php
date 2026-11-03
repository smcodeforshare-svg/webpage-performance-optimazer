<?php

function list_posts() {
    $posts = get_posts();
    foreach ($posts as $post) {
        $wpdb->get_results("SELECT * FROM wp_posts WHERE ID = {$post->ID}");
    }

    $html = file_get_contents('https://example.com/feed');
    return $html;
}

function render_items() {
    $items = ['a', 'b', 'c'];
    for ($i = 0; $i < count($items); $i++) {
        echo $items[$i];
    }
}
