#!/usr/bin/env python3
"""
Comprehensive Order Product Fix Script
=======================================
Uses Excel data + Docker logs + Database to fix all wrong products
"""

import os
import sys
from datetime import datetime, timezone
from decimal import Decimal

# Add project to path
sys.path.insert(0, '/opt/Aarya_clothing_frontend')

from sqlalchemy import text
from database.database import SessionLocal

# Excel Data (from your export)
EXCEL_DATA = """
ORD-000044|pritisushant2@gmail.com|Priti patil|7666225914|test product1(not for sale)|38|Mauve|1|1|1|razorpay||Priti patil, Building no 5, flat no 103, meera park, gaikwad pada, Ambarnath ,dist: thane , Building no 5, flat no 103, meera park, gaikwad pada, Ambarnath , Ambarnath , Maharashtra - 421501, Phone: 7666225914|18/04/2026|confirmed
ORD-000045|paruljainn0987@gmail.com|Parul|6378866792|2-Piece suit with Dual Pocket|M|Black|1|449|898|upi||Parul, Meera marg , Jaipur, Rajasthan - 302020, Phone: 6378866792|18/04/2026|confirmed
ORD-000045|paruljainn0987@gmail.com|Parul|6378866792|2-Piece suit with Dual Pocket|L|Red|1|449|898|upi||Parul, Meera marg , Jaipur, Rajasthan - 302020, Phone: 6378866792|18/04/2026|confirmed
ORD-000046|soniyakhanna16@yahoo.com|Sonia Khanna|6393553654|(No items)|||0|300|300|upi||Address to be confirmed|16/04/2026|confirmed
ORD-000043|rneeraj6002@gmail.com|Neeraj|7976098547|2-Piece Pink suit with Plazo|L|Standard|1|299|299|razorpay||Neeraj rajput , D-96 gali no 12 shiv ram park  , Nangloi, Delhi , Delhi - 110041, Phone: 7976098547|16/04/2026|confirmed
ORD-000042|rneeraj6002@gmail.com|Neeraj|7976098547|Floral- flower pattern Gown|XXL|Floral-pink|1|249|249|razorpay||Neeraj rajput , D-96 gali no 12 shiv ram park  , Nangloi, Delhi , Delhi - 110041, Phone: 7976098547|16/04/2026|confirmed
ORD-000041|sonaallabadi81@gmail.com|Bhavana|8654988159|2-piece leaf pattern|XL|Standard|1|400|400|razorpay||Bhavana Allabadi , Kala Sayed Tara ganj, Beldhar Pura road pal kirna k pass lashker gwalior 474001, Gwalior , Madhya Pradesh - 474001, Phone: 8654988159|16/04/2026|shipped
ORD-000040|monishagarai0@gmail.com|Monisha Garai|9564394838|1 Piece suit|M|Blue-slit|1|250|250|razorpay||Monisha Garai Ghosh , Elite Rangoli, Block 2, 4D. Manikpur, Rajabari, Dumdum, 10 meter ahead of Ganesh vaban, Kolkata , West Bengal - 700081, Phone: 9832730389|16/04/2026|shipped
ORD-000039|sapnabhari1985@gmail.com|Sapna|7521055064|Floral Print Crepe Party Wear Gown|XL|#2C2A5A|1|650|650|razorpay||sapna kumar, 401A,401A ,I Block silverline apartment ayodhya roa opposite BBD University lucknow 226028, near crown mall, lucknow, Uttar Pradesh - 226028, Phone: 7521055064|16/04/2026|shipped
ORD-000038|simersim2082@gmail.com|Simerjeet|9958640908|2- piece suit|XL|Standard|1|300|300|razorpay||Simerjeet, A 128 GF Ganesh Nagar , Tilak nagar , New Delhi , Delhi - 110018, Phone: 9958640908|16/04/2026|shipped
ORD-000037|jyotiasava8185@gmail.com|Jyoti asava|+919723911494|1 Piece suit|M|Blue-slit|1|250|650|razorpay||Jyoti Asava, Karelibaug, Opposite jalaram mandir, Vadodara , Gujarat - 390018, Phone: 9723911494|16/04/2026|shipped
ORD-000037|jyotiasava8185@gmail.com|Jyoti asava|+919723911494|2-Piece suit|XXL|Purple|1|400|650|razorpay||Jyoti Asava, Karelibaug, Opposite jalaram mandir, Vadodara , Gujarat - 390018, Phone: 9723911494|16/04/2026|shipped
ORD-000036|shaziahassanm@gmail.com|Shazia Tabassum|8686414847|Floral- flower pattern Gown|XXL|Floral-pink|1|249|249|razorpay||Shazia Tabassum, SR DIGI SCHOOL LANE, Karimnagar, Telangana - 505001, Phone: 8686414847|16/04/2026|shipped
ORD-000035|rashmisiddappa2@gmail.com|Rashmi|+918310250003|test product1(not for sale)|38|Mauve|1|1|1|razorpay||Rashmi Siddappa , #33,1st floor,Reo Store Building,, Bharathi Layout,S.G.Palya, Bengaluru , Karnataka - 560100, Phone: 8310250003|15/04/2026|confirmed
ORD-000034|drmeenafzr@gmail.com|Dr. Meena Sharma|9876836366|Khadi Cotton Kurta Set with Embroidered Neckline|M|#7A1F2B|1|499|1724|razorpay||Dr. Meena Sharma , H.L.12 , Phase 7, SAS Nagar, Mohali , Punjab - 160062, Phone: 9876836366|15/04/2026|shipped
ORD-000034|drmeenafzr@gmail.com|Dr. Meena Sharma|9876836366|Royal Silk A-Line Suit Set with Embroidered Yoke|M|#7A1F2B|1|550|1724|razorpay||Dr. Meena Sharma , H.L.12 , Phase 7, SAS Nagar, Mohali , Punjab - 160062, Phone: 9876836366|15/04/2026|shipped
ORD-000034|drmeenafzr@gmail.com|Dr. Meena Sharma|9876836366|3 Piece Kurta Set|M|Navy|1|675|1724|razorpay||Dr. Meena Sharma , H.L.12 , Phase 7, SAS Nagar, Mohali , Punjab - 160062, Phone: 9876836366|15/04/2026|shipped
ORD-000033|anubala121181@gmail.com|Anu|8054282486|test product1(not for sale)|38|Mauve|1|1|1|razorpay||Anu bala , Town Hall , Amritsar , Punjab - 143001, Phone: 8054282486|15/04/2026|confirmed
ORD-000032|lovelykumari0204@gmail.com|Lovely Kumari|7209136372|2-Piece suit with Dual Pocket|XXL|Red|1|449|449|razorpay||Lovely Kumari, Mi28 Chanchala Apartment, Northen Division, Rourkela, Odisha - 769015, Phone: 7209136372|15/04/2026|shipped
ORD-000031|arpana3182@gmail.com|arpana singh|7982893182|Teal Blossom Chanderi Kurta Set|M|#4A9A8A|1|599|599|razorpay||Arpana singh, Tower 3 10 g marlin apartment, 40 SWARNAMOYEE road near Shalimar railway station, Howrah, West Bengal - 711103, Phone: 7982893182|15/04/2026|shipped
ORD-000030|jainpoojika@gmail.com|poojika jain|9009025877|Ivory Ember Zardozi Suit Set|M|#F2E8D5|1|750|750|razorpay||Kushal ranka, H.no 204,Mr3, Mahalaxmi Nagar, Indore, Madhya Pradesh - 452010, Phone: 9009025877|15/04/2026|cancelled
ORD-000029|jyoti09482@gmail.com|Sukriti|8207415211|2-Piece Pink suit with Plazo|L|Standard|1|299|299|razorpay||Jyoti Kumari , Pant Nagar shri ram colony road no 2 near Durga mandir , Pant Nagar , Gaya, Bihar - 823001, Phone: 9934610485|15/04/2026|delivered
ORD-000028|sheetal.mahindrakar@gmail.com|Sheetal Mahindrakar|+919922432512|1 Piece suit|XXL|Pink- slit|1|299|299|razorpay||Sheetal Mahindrakar, A-401, Royal casa, Bhondve corner, Ravet, Pune, Maharashtra - 412101, Phone: 9922432512|15/04/2026|shipped
ORD-000027|prabh52409@gmail.com|Prabhdeep Kaur|+919914700551|Scarlet Bloom Hand-Embroidered Crepe Kurta set|M|#E30613|1|799|799|razorpay||Prabhdeep Kaur, B1, 906, Ajnara Homes, Sector 16B, Greater Noida, Uttar Pradesh - 201306, Phone: 9914700551|14/04/2026|delivered
ORD-000026|radhaparag@gmail.com|Radha|8860149863|Coral Printed Rayon 3-Piece Frock Suit Set|M|Coral|1|499|499|razorpay||Radha, Inland waterways authority of India, A-13, sector-1, Noida, Noida, Uttar Pradesh - 201301, Phone: 8860149863|14/04/2026|delivered
ORD-000025|leena.dhande@gmail.com|Leena Dhande|+919833947011|Teal Blossom Chanderi Kurta Set|M|#4A9A8A|1|599|599|razorpay||Leena Dhande, 3rd Floor, Flat No 22, Amarkunj Building , Veer Savarkar Road, Shivaji Park, Dadar (West), Mumbai, Maharashtra - 400028, Phone: 9833947011|14/04/2026|delivered
ORD-000024|twinkle.dsdg@gmail.com|Dr Sapna|9898244423|Floral Print Crepe Party Wear Gown|M|#2C2A5A|1|650|1149|razorpay||Dr Sapna Gupta , B/102, Karyashiromani Towers,  opp. Chandralok apartament, Near Ghevar Circle, , , Dafnana Road, Shahibag, Ahmedabad , Gujarat - 380004, Phone: 9898244423|13/04/2026|delivered
ORD-000023|dhwaniagrawal214@gmail.com|dhwani|9571146430|test product1(not for sale)|38|Mauve|1|1|1|razorpay||Dhwani, Meera marg, Jaipur, Rajasthan - 302020, Phone: 6378866792|10/04/2026|shipped
"""

def get_db():
    """Get database session."""
    return SessionLocal()

def parse_excel_data():
    """Parse Excel data string."""
    orders = {}
    lines = EXCEL_DATA.strip().split('\n')
    for line in lines:
        if not line.strip():
            continue
        parts = [p.strip() for p in line.split('|')]
        if len(parts) >= 11:
            order_id, email, name, phone, product, size, color, quantity, price, total, payment = parts[:11]
            orders[order_id] = {
                'email': email,
                'name': name,
                'phone': phone,
                'product': product,
                'size': size,
                'color': color,
                'quantity': int(quantity),
                'price': float(price),
                'total': float(total),
                'payment': payment
            }
    return orders

def get_orders_in_db():
    """Get all orders from database."""
    db = get_db()
    try:
        query = text("""
            SELECT
                o.id,
                o.invoice_number,
                o.transaction_id,
                o.user_id,
                o.status,
                o.total_amount,
                o.payment_method,
                o.created_at,
                COUNT(oi.id) as item_count,
                STRING_AGG(DISTINCT oi.product_name, ', ' ORDER BY oi.product_name) as products_in_db
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
                'order_id': row.id,
                'invoice_number': row.invoice_number,
                'transaction_id': row.transaction_id,
                'user_id': row.user_id,
                'status': row.status,
                'total_amount': float(row.total_amount),
                'payment_method': row.payment_method,
                'created_at': row.created_at,
                'item_count': row.item_count,
                'products_in_db': row.products_in_db if row.products_in_db else None
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

def find_order_matches(excel_data, orders_in_db):
    """Find matches between Excel data and database orders."""
    matches = []
    unmatched_db = []
    unmatched_excel = []

    # Create lookup by transaction_id, invoice_number, email, phone, name
    excel_by_transaction = {}
    excel_by_email = {}
    excel_by_phone = {}
    excel_by_name = {}

    for order_id, data in excel_data.items():
        excel_by_transaction[data['payment']] = order_id
        excel_by_email[data['email']] = order_id
        excel_by_phone[data['phone']] = order_id
        excel_by_name[data['name']] = order_id

    # Match database orders
    for order in orders_in_db:
        matched = None
        # Try transaction_id first
        if order['transaction_id'] and order['transaction_id'] in excel_by_transaction:
            matched = excel_by_transaction[order['transaction_id']]
        # Try invoice_number
        elif order['invoice_number']:
            invoice_num = order['invoice_number'].replace('INV-', '').replace('ORD-', '')
            for email, order_id in excel_by_email.items():
                if email == invoice_num:
                    matched = order_id
                    break
        # Try email match
        elif order['user_id']:
            email_match = excel_by_email.get(str(order['user_id']))
            if email_match:
                matched = email_match

        if matched:
            excel_data[matched]['db_order_id'] = order['order_id']
            matches.append({
                'excel_order_id': matched,
                'db_order_id': order['order_id'],
                'db_data': order,
                'excel_data': excel_data[matched]
            })
        else:
            unmatched_db.append(order)

    # Find unmatched Excel orders
    for order_id, data in excel_data.items():
        if 'db_order_id' not in data:
            unmatched_excel.append(order_id)

    return matches, unmatched_db, unmatched_excel

def generate_fix_plan(matches, unmatched_db, unmatched_excel, excel_data):
    """Generate detailed fix plan."""
    report = []
    report.append("=" * 120)
    report.append("COMPREHENSIVE ORDER PRODUCT FIX PLAN")
    report.append("=" * 120)
    report.append(f"Generated at: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    report.append("")
    report.append(f"Total Excel Orders: {len(unmatched_excel) + len(matches)}")
    report.append(f"Total Database Orders: {len(unmatched_db) + len(matches)}")
    report.append(f"✓ Orders with matches: {len(matches)}")
    report.append(f"❌ Database orders unmatched: {len(unmatched_db)}")
    report.append(f"➖ Excel orders unmatched: {len(unmatched_excel)}")
    report.append("")

    # Summary by category
    wrong_products = 0
    no_items = 0
    needs_fix = 0

    report.append("=" * 120)
    report.append("📊 CATEGORIZATION:")
    report.append("=" * 120)

    for match in matches:
        excel = match['excel_data']
        db = match['db_data']
        if excel['product'] == '(No items)':
            no_items += 1
        elif excel['product'] == 'test product1(not for sale)':
            no_items += 1
        else:
            if db['products_in_db'] == 'Crepe Party Wear Gown with Belt':
                wrong_products += 1
            needs_fix += 1

    report.append(f"❌ Orders with WRONG product: {wrong_products}")
    report.append(f"➖ Orders with NO items: {no_items}")
    report.append(f"✓ Total orders needing fix: {needs_fix}")
    report.append("")

    # Detailed fix plan
    report.append("=" * 120)
    report.append("📋 DETAILED FIX PLAN:")
    report.append("=" * 120)
    report.append("")
    report.append("ORDERS WITH MATCHES (Can be FIXED):")
    report.append("-" * 120)
    report.append(f"{'Order ID':<12} {'Excel Product':<45} {'DB Product':<45}")
    report.append("-" * 120)

    for match in matches:
        excel = match['excel_data']
        db = match['db_data']
        excel_prod = excel['product']
        db_prod = db['products_in_db'] if db['products_in_db'] else 'NO ITEMS'
        report.append(f"{excel['excel_order_id']:<12} {excel_prod:<45} {db_prod:<45}")

    report.append("")

    # Database orders that can't be matched
    report.append("=" * 120)
    report.append("⚠ DATABASE ORDERS UNMATCHED (Need Manual Review):")
    report.append("=" * 120)
    report.append("")

    for order in unmatched_db:
        report.append(f"Order ID: {order['order_id']}")
        report.append(f"  Invoice: {order['invoice_number']}")
        report.append(f"  Transaction: {order['transaction_id']}")
        report.append(f"  Payment Method: {order['payment_method']}")
        report.append(f"  Total: ₹{order['total_amount']:.2f}")
        report.append(f"  Current Product: {order['products_in_db'] or 'NO ITEMS'}")
        report.append("")

    # Excel orders unmatched
    report.append("=" * 120)
    report.append("➖ EXCEL ORDERS UNMATCHED (Need Manual Review):")
    report.append("=" * 120)
    report.append("")

    for order_id in unmatched_excel:
        report.append(f"Order ID: {order_id}")
        report.append(f"  Email: {excel_data[order_id]['email']}")
        report.append(f"  Name: {excel_data[order_id]['name']}")
        report.append(f"  Phone: {excel_data[order_id]['phone']}")
        report.append(f"  Product: {excel_data[order_id]['product']}")
        report.append(f"  Amount: ₹{excel_data[order_id]['total']:.2f}")
        report.append("")

    # Fix execution plan
    report.append("=" * 120)
    report.append("🔧 FIX EXECUTION PLAN:")
    report.append("=" * 120)
    report.append("")

    report.append("Step 1: Update correct products for matched orders")
    report.append(f"  - Total orders: {len(matches)}")
    report.append(f"  - Wrong product corrections: {wrong_products}")
    report.append(f"  - No item orders: {no_items}")
    report.append("")

    report.append("Step 2: Manually review unmatched orders")
    report.append(f"  - Database orders: {len(unmatched_db)}")
    report.append(f"  - Excel orders: {len(unmatched_excel)}")
    report.append("")

    report.append("Step 3: Backup database before applying fixes")
    report.append("  - Command: pg_dump aarya_clothing > backup_before_fix.sql")
    report.append("")

    # Generate SQL commands
    report.append("=" * 120)
    report.append("📝 GENERATING SQL FIX COMMANDS:")
    report.append("=" * 120)
    report.append("")

    for match in matches:
        excel = match['excel_data']
        db_order_id = match['db_order_id']

        if excel['product'] == '(No items)' or excel['product'] == 'test product1(not for sale)':
            report.append(f"-- Order {excel['excel_order_id']}: NO ITEMS (keep as is)")
        elif db['products_in_db'] == 'Crepe Party Wear Gown with Belt':
            report.append(f"-- Order {excel['excel_order_id']}: FIXING PRODUCT")
            report.append(f"UPDATE order_items SET product_name = '{excel['product']}', sku = NULL, size = '{excel['size']}', color = '{excel['color']}'")
            report.append(f"WHERE order_id = {db_order_id};")
        else:
            report.append(f"-- Order {excel['excel_order_id']}: PRODUCT ALREADY CORRECT")
        report.append("")

    report.append("=" * 120)
    report.append("✅ FIX PLAN COMPLETE!")
    report.append("=" * 120)

    return '\n'.join(report)

def main():
    print("🔍 Parsing Excel data...")
    excel_data = parse_excel_data()
    print(f"✓ Parsed {len(excel_data)} orders from Excel")

    print("🔍 Fetching database orders...")
    orders_in_db = get_orders_in_db()
    print(f"✓ Found {len(orders_in_db)} orders in database")

    print("🔍 Finding matches...")
    matches, unmatched_db, unmatched_excel = find_order_matches(excel_data, orders_in_db)
    print(f"✓ Found {len(matches)} matches")
    print(f"  - Unmatched database orders: {len(unmatched_db)}")
    print(f"  - Unmatched Excel orders: {len(unmatched_excel)}")

    print("\n📊 Generating fix plan...")
    report = generate_fix_plan(matches, unmatched_db, unmatched_excel, excel_data)

    print("\n" + report)

    # Save report to file
    report_filename = f"/opt/Aarya_clothing_frontend/order_fix_plan_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.txt"
    with open(report_filename, 'w') as f:
        f.write(report)

    print(f"\n✅ Fix plan saved to: {report_filename}")

    # Print summary
    print("\n" + "=" * 120)
    print("🎯 FIX SUMMARY:")
    print("=" * 120)
    print(f"Total orders to fix: {len(matches)}")
    print(f"  - Wrong product corrections: {sum(1 for m in matches if 'Crepe Party Wear Gown' in m['db_data']['products_in_db'])}")
    print(f"  - No item orders: {sum(1 for m in matches if m['excel_data']['product'] in ['(No items)', 'test product1(not for sale)'])}")
    print(f"Unmatched database orders: {len(unmatched_db)} (needs manual review)")
    print(f"Unmatched Excel orders: {len(unmatched_excel)} (needs manual review)")

if __name__ == "__main__":
    main()
