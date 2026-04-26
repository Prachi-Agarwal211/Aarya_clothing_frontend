#!/usr/bin/env python3
"""
Generate Comprehensive Order Mapping
=====================================
This script creates a detailed mapping of:
1. What's currently in the database (WRONG)
2. What should be there (from your export)
3. Fix plan for each order
"""

import os
import sys
from datetime import datetime

# Add project to path
sys.path.insert(0, '/opt/Aarya_clothing_frontend')

# Database connection
from sqlalchemy import text
from database.database import SessionLocal

def get_db():
    """Get database session."""
    return SessionLocal()

def get_orders_in_db():
    """Get all orders from database."""
    db = get_db()
    try:
        query = text("""
            SELECT
                o.id as order_id,
                o.invoice_number,
                o.transaction_id,
                o.user_id,
                o.status,
                o.total_amount,
                o.payment_method,
                o.created_at,
                COUNT(oi.id) as item_count,
                STRING_AGG(DISTINCT oi.product_name, ', ' ORDER BY oi.product_name) as products_in_db,
                STRING_AGG(DISTINCT oi.sku, ', ' ORDER BY oi.sku) as skus_in_db
            FROM orders o
            LEFT JOIN order_items oi ON oi.order_id = o.id
            WHERE o.created_at >= '2026-04-06T00:00:00'::timestamp
            GROUP BY o.id, o.invoice_number, o.transaction_id, o.user_id, o.status, o.total_amount, o.payment_method, o.created_at
            ORDER BY o.id DESC
        """)
        result = db.execute(query)
        orders = []
        for row in result:
            orders.append({
                'order_id': row.order_id,
                'invoice_number': row.invoice_number,
                'transaction_id': row.transaction_id,
                'user_id': row.user_id,
                'status': row.status,
                'total_amount': float(row.total_amount),
                'payment_method': row.payment_method,
                'created_at': row.created_at,
                'item_count': row.item_count,
                'products_in_db': row.products_in_db if row.products_in_db else None,
                'skus_in_db': row.skus_in_db if row.skus_in_db else None
            })
        return orders
    finally:
        db.close()

def get_order_items_detail(order_id):
    """Get detailed order items for an order."""
    db = get_db()
    try:
        query = text("""
            SELECT
                oi.product_name,
                oi.sku,
                oi.size,
                oi.color,
                oi.quantity,
                oi.unit_price,
                oi.price
            FROM order_items oi
            WHERE oi.order_id = :order_id
            ORDER BY oi.id
        """)
        result = db.execute(query, {'order_id': order_id})
        items = []
        for row in result:
            items.append({
                'product_name': row.product_name,
                'sku': row.sku,
                'size': row.size,
                'color': row.color,
                'quantity': row.quantity,
                'unit_price': float(row.unit_price),
                'price': float(row.price)
            })
        return items
    finally:
        db.close()

def generate_mapping(export_data=None):
    """Generate comprehensive order mapping."""
    print("=" * 100)
    print("COMPREHENSIVE ORDER MAPPING REPORT")
    print("=" * 100)
    print(f"Generated at: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print()

    # Get orders from database
    orders = get_orders_in_db()

    print(f"Total orders in database: {len(orders)}")
    print(f"Orders to fix: {len(orders)}")
    print()

    # Analyze data
    wrong_products = []
    correct_products = []
    no_items = []
    mixed_products = []

    for order in orders:
        products = order['products_in_db']
        if not products:
            no_items.append(order)
        elif products == "Crepe Party Wear Gown with Belt":
            wrong_products.append(order)
        else:
            mixed_products.append(order)

    print("=" * 100)
    print("CATEGORIZATION:")
    print("=" * 100)
    print(f"❌ Orders with WRONG product (Crepe Party Wear Gown): {len(wrong_products)}")
    print(f"✓ Orders with CORRECT product: {len(correct_products)}")
    print(f"⚠ Orders with mixed products: {len(mixed_products)}")
    print(f"➖ Orders with NO items: {len(no_items)}")
    print()

    # Generate detailed report for each category
    if wrong_products:
        print("=" * 100)
        print("📋 ORDERS WITH WRONG PRODUCT - NEEDS FIX")
        print("=" * 100)
        print(f"{'Order ID':<12} {'Invoice':<18} {'Amount':<10} {'Payment':<15} {'Current Product':<50}")
        print("-" * 100)

        for order in wrong_products:
            print(f"{order['order_id']:<12} {order['invoice_number']:<18} ₹{order['total_amount']:<8.2f} {order['payment_method']:<15} {order['products_in_db'] or 'N/A':<50}")

        print()

    if correct_products:
        print("=" * 100)
        print("✅ ORDERS WITH CORRECT PRODUCT - NO FIX NEEDED")
        print("=" * 100)
        print(f"{'Order ID':<12} {'Invoice':<18} {'Amount':<10} {'Payment':<15} {'Current Product':<50}")
        print("-" * 100)

        for order in correct_products:
            print(f"{order['order_id']:<12} {order['invoice_number']:<18} ₹{order['total_amount']:<8.2f} {order['payment_method']:<15} {order['products_in_db'] or 'N/A':<50}")

        print()

    if no_items:
        print("=" * 100)
        print("➖ ORDERS WITH NO ITEMS - NEEDS FIX")
        print("=" * 100)
        print(f"{'Order ID':<12} {'Invoice':<18} {'Amount':<10} {'Payment':<15} {'Status':<15}")
        print("-" * 100)

        for order in no_items:
            print(f"{order['order_id']:<12} {order['invoice_number']:<18} ₹{order['total_amount']:<8.2f} {order['payment_method']:<15} {order['status']:<15}")

        print()

    # Detailed breakdown by payment method
    print("=" * 100)
    print("📊 BREAKDOWN BY PAYMENT METHOD:")
    print("=" * 100)
    payment_methods = {}
    for order in orders:
        pm = order['payment_method']
        if pm not in payment_methods:
            payment_methods[pm] = {'total': 0, 'count': 0, 'wrong': 0}
        payment_methods[pm]['total'] += order['total_amount']
        payment_methods[pm]['count'] += 1
        if order['products_in_db'] == "Crepe Party Wear Gown with Belt":
            payment_methods[pm]['wrong'] += 1

    for pm, data in sorted(payment_methods.items()):
        print(f"Payment Method: {pm}")
        print(f"  Total Amount: ₹{data['total']:.2f}")
        print(f"  Order Count: {data['count']}")
        print(f"  Wrong Product Count: {data['wrong']}")
        print()

    # Generate fix plan summary
    print("=" * 100)
    print("🔧 FIX PLAN SUMMARY:")
    print("=" * 100)
    print(f"Total orders to review: {len(orders)}")
    print(f"Orders with WRONG product: {len(wrong_products)}")
    print(f"Orders with NO items: {len(no_items)}")
    print(f"Total orders needing fix: {len(wrong_products) + len(no_items) + len(mixed_products)}")
    print()

    # Save detailed report to file
    report_filename = f"/opt/Aarya_clothing_frontend/order_mapping_report_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.txt"
    with open(report_filename, 'w') as f:
        f.write("COMPREHENSIVE ORDER MAPPING REPORT\n")
        f.write("=" * 100 + "\n")
        f.write(f"Generated at: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}\n")
        f.write("\n")
        f.write(f"Total orders in database: {len(orders)}\n")
        f.write(f"Orders with WRONG product: {len(wrong_products)}\n")
        f.write(f"Orders with CORRECT product: {len(correct_products)}\n")
        f.write(f"Orders with NO items: {len(no_items)}\n")
        f.write("\n")
        f.write("=" * 100 + "\n")
        f.write("DETAILS BY CATEGORY\n")
        f.write("=" * 100 + "\n\n")

        # Wrong products
        f.write("ORDERS WITH WRONG PRODUCT - NEEDS FIX\n")
        f.write("-" * 100 + "\n")
        f.write(f"{'Order ID':<12} {'Invoice':<18} {'Amount':<10} {'Payment':<15} {'Current Product':<50}\n")
        f.write("-" * 100 + "\n")
        for order in wrong_products:
            f.write(f"{order['order_id']:<12} {order['invoice_number']:<18} ₹{order['total_amount']:<8.2f} {order['payment_method']:<15} {order['products_in_db'] or 'N/A':<50}\n")
        f.write("\n")

        # Correct products
        f.write("ORDERS WITH CORRECT PRODUCT - NO FIX NEEDED\n")
        f.write("-" * 100 + "\n")
        f.write(f"{'Order ID':<12} {'Invoice':<18} {'Amount':<10} {'Payment':<15} {'Current Product':<50}\n")
        f.write("-" * 100 + "\n")
        for order in correct_products:
            f.write(f"{order['order_id']:<12} {order['invoice_number']:<18} ₹{order['total_amount']:<8.2f} {order['payment_method']:<15} {order['products_in_db'] or 'N/A':<50}\n")
        f.write("\n")

        # No items
        f.write("ORDERS WITH NO ITEMS - NEEDS FIX\n")
        f.write("-" * 100 + "\n")
        f.write(f"{'Order ID':<12} {'Invoice':<18} {'Amount':<10} {'Payment':<15} {'Status':<15}\n")
        f.write("-" * 100 + "\n")
        for order in no_items:
            f.write(f"{order['order_id']:<12} {order['invoice_number']:<18} ₹{order['total_amount']:<8.2f} {order['payment_method']:<15} {order['status']:<15}\n")
        f.write("\n")

    print(f"✅ Detailed report saved to: {report_filename}")
    print()
    print("=" * 100)

    return {
        'total_orders': len(orders),
        'wrong_products': len(wrong_products),
        'correct_products': len(correct_products),
        'no_items': len(no_items),
        'mixed_products': len(mixed_products)
    }

if __name__ == "__main__":
    from datetime import timezone
    stats = generate_mapping()
