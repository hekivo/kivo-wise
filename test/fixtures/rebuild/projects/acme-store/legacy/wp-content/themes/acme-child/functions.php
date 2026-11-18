<?php
/**
 * Acme Store child theme (legacy).
 */

// Checkout: state registration number, required for business buyers.
add_filter('woocommerce_checkout_fields', function (array $fields): array {
    $fields['billing']['billing_state_registration'] = [
        'type'        => 'text',
        'label'       => __('State registration', 'acme'),
        'placeholder' => __('Digits only', 'acme'),
        'required'    => false,
        'class'       => ['form-row-wide'],
        'priority'    => 35,
    ];

    return $fields;
});

// The value is saved on the order and shown in the admin order screen.
add_action('woocommerce_checkout_update_order_meta', function (int $order_id): void {
    if (! empty($_POST['billing_state_registration'])) {
        update_post_meta($order_id, '_billing_state_registration', sanitize_text_field(wp_unslash($_POST['billing_state_registration'])));
    }
});

add_action('woocommerce_admin_order_data_after_billing_address', function (WC_Order $order): void {
    $value = get_post_meta($order->get_id(), '_billing_state_registration', true);
    if ($value) {
        echo '<p><strong>' . esc_html__('State registration', 'acme') . ':</strong> ' . esc_html($value) . '</p>';
    }
});
