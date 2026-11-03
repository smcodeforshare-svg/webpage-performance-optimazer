<?php
/**
 * Sample WordPress functions.php with common bottlenecks
 */

function get_custom_post_details($post_ids) {
    global $wpdb;
    $details = [];

    // Bottleneck 1: N+1 query loop fetching data per post ID
    foreach ($post_ids as $pid) {
        $meta = $wpdb->get_results("SELECT * FROM {$wpdb->postmeta} WHERE post_id = $pid");
        $details[$pid] = $meta;
    }

    return $details;
}

function fetch_external_stock_ticker() {
    // Bottleneck 2: Blocking remote file_get_contents without timeout
    $raw = file_get_contents("https://api.stocks.local/v1/ticker");
    return json_decode($raw, true);
}

function process_order_items($items) {
    // Bottleneck 3: Recalculating count() on every for-loop iteration
    for ($i = 0; $i < count($items); $i++) {
        $items[$i]['processed'] = true;
    }
    return $items;
}

function fetch_user_record_unsafe($user_id) {
    global $wpdb;
    // Bottleneck 4: Direct unescaped SQL variable interpolation
    $row = $wpdb->get_row("SELECT * FROM {$wpdb->users} WHERE ID = $user_id");
    return $row;
}
