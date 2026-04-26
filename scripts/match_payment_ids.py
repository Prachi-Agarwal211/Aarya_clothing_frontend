#!/usr/bin/env python3
"""
Match Docker Logs Payment IDs with Your Excel Orders
=====================================================
This script parses Docker logs to find payment IDs and matches them with your Excel data
"""

import os
import sys
from datetime import datetime, timezone
import re

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
ORD-000037|jyotiasava8185@gmail.com|Jyoti asava|+919723911494|1 Piece suit|XL|Blue-slit|1|250|650|razorpay||Jyoti Asava, Karelibaug, Opposite jalaram mandir, Vadodara , Gujarat - 390018, Phone: 9723911494|16/04/2026|shipped
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
ORD-000013|kalawanti2905@gmail.com|Dr. Dinesh Jindal|+919815585950|(No items)|||0|850|850|razorpay||Bhawna garg jindal, Tower street ,opposite Dj Aman, Bus stand road,Near Kakarwal Pul, Dhuri, Punjab 148024|07/04/2026|confirmed
ORD-000014|dhwaniagrawal214@gmail.com|dhwani|9571146430|(No items)|||0|299|299|razorpay||Dhwani, Meera marg, Jaipur, Rajasthan 302020|07/04/2026|confirmed
ORD-000016|vimal1979jain@gmail.com|vimal|+919610455717|(No items)|||0|900|900|razorpay||Vimal Jain, Mansarovar Jaipur 302020, Jaipur, Rajasthan 302020|07/04/2026|confirmed
ORD-000015|6543priyanka@gmail.com|Priyanka Sharma|9622650314|(No items)|||0|475|475|razorpay||Priyanka Sharma, Vpo gurha btahmana near baba jio nath temple, Jammu, Jammu and Kashmir 181201|07/04/2026|confirmed
ORD-000017|admin@aarya.com|System Administrator|9999999999|(No items)|||0|299|299|razorpay||57557||07/04/2026|shipped
ORD-000012|seemagaba0706@gmail.com|Seema Gaba|7404605707|Chikankari Kurti|L|Lavender|1|299|299|razorpay||243900401002||07/04/2026|delivered
ORD-000005|vimal1979jain@gmail.com|vimal|+919610455717|A line Cord Set|XL|Standard|1|475|475|razorpay||Vimal Jain , Mansarovar Jaipur 302020, Jaipur , Rajasthan - 302020, Phone: 9610455717|06/04/2026|confirmed
"""

# Sample payment IDs found in logs
PAYMENT_IDS_IN_LOGS = [
    "pay_SgqDRBynweIvDK",  # from user=69 (Priti? No, Priti is 7666225914, not in logs)
    "pay_SgtEexkhic41Ot",  # from user=1177
    "pay_Sh3iGWpKCmCFDG",  # from user=1177
    "pay_SaQ2YtsRMZTXv4",  # from user=236
    "pay_SaVzrppVV26q3c",  # from user=15
    "pay_SZq90iBpCHjz2P",  # from user=16
    "pay_SaaeymzeDIldYe",  # from user=13
    "pay_Sa5ojo7Vq6EWd4",  # from user=15
]

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

def get_orders_from_db():
    """Get all orders from database."""
    from sqlalchemy import text
    from database.database import SessionLocal

    db = SessionLocal()
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
                STRING_AGG(DISTINCT oi.product_name, ', ') as products_in_db
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
                'products_in_db': row.products_in_db if row.products_in_db else None
            })
        return orders
    finally:
        db.close()

def match_payment_ids(excel_data, db_orders):
    """Match payment IDs from logs with Excel and database orders."""
    print("=" * 120)
    print("PAYMENT ID MATCHING - Docker Logs vs Excel vs Database")
    print("=" * 120)
    print()

    # Create Excel lookup
    excel_by_email = {}
    excel_by_phone = {}
    excel_by_name = {}
    excel_by_payment = {}

    for order_id, data in excel_data.items():
        excel_by_email[data['email']] = order_id
        excel_by_phone[data['phone']] = order_id
        excel_by_name[data['name']] = order_id
        excel_by_payment[data['payment']] = order_id

    # Match payment IDs to orders
    matches = []
    payment_mapping = {}

    for payment_id in PAYMENT_IDS_IN_LOGS:
        # Find matching Excel order
        excel_match = None
        if payment_id in excel_by_payment:
            excel_match = excel_by_payment[payment_id]
        elif payment_id in excel_by_email:
            excel_match = excel_by_email[payment_id]
        elif payment_id in excel_by_phone:
            excel_match = excel_by_phone[payment_id]

        # Find matching database order
        db_match = None
        for order in db_orders:
            if order['transaction_id'] == payment_id:
                db_match = order
                break

        if excel_match or db_match:
            matches.append({
                'payment_id': payment_id,
                'excel_order_id': excel_match,
                'excel_data': excel_data[excel_match] if excel_match else None,
                'db_order': db_match
            })
            if excel_match:
                payment_mapping[payment_id] = excel_match

    print(f"Found {len(matches)} payment ID matches")
    print()

    return matches, payment_mapping

def generate_report(matches, payment_mapping):
    """Generate matching report."""
    report = []
    report.append("=" * 120)
    report.append("PAYMENT ID MAPPING REPORT")
    report.append("=" * 120)
    report.append(f"Generated at: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    report.append("")

    # Summary
    matched_payments = len([m for m in matches if m['db_order']])
    matched_excel = len([m for m in matches if m['excel_data']])

    report.append("SUMMARY:")
    report.append("-" * 120)
    report.append(f"Payment IDs checked: {len(PAYMENT_IDS_IN_LOGS)}")
    report.append(f"Matches with database orders: {matched_payments}")
    report.append(f"Matches with Excel orders: {matched_excel}")
    report.append(f"Total matched orders: {matched_payments + matched_excel}")
    report.append("")

    # Payment ID to Order ID mapping
    report.append("=" * 120)
    report.append("PAYMENT ID → ORDER ID MAPPING:")
    report.append("=" * 120)
    report.append("")

    for payment_id, order_id in sorted(payment_mapping.items()):
        excel = excel_data = None
        db_order = None

        for match in matches:
            if match['payment_id'] == payment_id:
                excel = match['excel_data']
                db_order = match['db_order']
                break

        report.append(f"Payment: {payment_id}")
        report.append(f"  → Excel Order ID: {order_id}")
        if excel:
            report.append(f"  → Customer: {excel['name']} ({excel['email']})")
            report.append(f"  → Product: {excel['product']}")
            report.append(f"  → Amount: ₹{excel['total']:.2f}")
        if db_order:
            report.append(f"  → DB Order ID: {db_order['order_id']}")
            report.append(f"  → DB Invoice: {db_order['invoice_number']}")
            report.append(f"  → DB Product: {db_order['products_in_db'] or 'NO ITEMS'}")
        report.append("")

    return '\n'.join(report)

if __name__ == "__main__":
    from database.database import SessionLocal
    from sqlalchemy import text

    print("Parsing Excel data...")
    excel_data = parse_excel_data()
    print(f"✓ Parsed {len(excel_data)} orders from Excel")

    print("Fetching database orders...")
    db_orders = get_orders_from_db()
    print(f"✓ Found {len(db_orders)} orders in database")

    print("Matching payment IDs...")
    matches, payment_mapping = match_payment_ids(excel_data, db_orders)

    print("\nGenerating report...")
    report = generate_report(matches, payment_mapping)

    print(report)

    # Save report
    report_filename = f"/opt/Aarya_clothing_frontend/payment_id_mapping_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.txt"
    with open(report_filename, 'w') as f:
        f.write(report)

    print(f"\n✅ Report saved to: {report_filename}")
