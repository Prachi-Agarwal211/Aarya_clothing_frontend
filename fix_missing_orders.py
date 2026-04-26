#!/usr/bin/env python3
"""
Fix Missing Orders Script
=======================
Creates PaymentTransaction + Order records for payments that exist in Razorpay
but are missing from our database due to IST/UTC timezone bug.
"""

import os
import sys
from datetime import datetime, timezone
from decimal import Decimal

# Add project to path
sys.path.insert(0, '/opt/Aarya_clothing_frontend')

os.environ['DATABASE_URL'] = 'postgresql://postgres:7v_CnHVZO97-fvFu9p8yNPHUAxrDb4puqcY662tTohs@aarya_postgres:5432/aarya_clothing'

from database.database import SessionLocal
from models.order import Order, OrderStatus, OrderItem
from models.payment import PaymentTransaction

def main():
    db = SessionLocal()
    
    # Get next invoice numbers
    invoice_seq = db.execute("SELECT nextval('invoice_number_seq')").scalar()
    invoices = [f"INV-2026-{invoice_seq + i:06d}" for i in range(6)]
    
    missing_payments = [
        {
            "razorpay_payment_id": "pay_SgdIqy1r4eioT9",
            "user_id": 472,
            "user_email": "twinkle.dsdg@gmail.com",
            "amount": Decimal("650.00"),
            "payment_method": "upi",
            "status": "completed",
            "created_at": datetime(2026, 4, 22, 18, 12, 23, tzinfo=timezone.utc),
            "completed_at": datetime(2026, 4, 22, 18, 12, 23, tzinfo=timezone.utc),
            "rrn": "611223194752",
            "contact": "+919898244423",
            "order_notes": "[RECOVERED] Razorpay pay_SgdIqy1r4eioT9 - \u20b9650 - VPA: twinkle.dsdg@okaxis"
        },
        {
            "razorpay_payment_id": "pay_SfIEipDZTECtRo",
            "user_id": 1319,
            "user_email": "maheshwarianjali201@gmail.com",
            "amount": Decimal("850.00"),
            "payment_method": "upi",
            "status": "completed",
            "created_at": datetime(2026, 4, 19, 9, 26, 58, tzinfo=timezone.utc),
            "completed_at": datetime(2026, 4, 19, 9, 26, 58, tzinfo=timezone.utc),
            "rrn": "610914966914",
            "contact": "+918777061192",
            "order_notes": "[RECOVERED] Razorpay pay_SfIEipDZTECtRo - \u20b9850 - VPA: 8777061192@kotak"
        },
        {
            "razorpay_payment_id": "pay_SgtEexkhic41Ot",
            "user_id": 1177,
            "user_email": None,
            "amount": Decimal("550.00"),
            "payment_method": "upi_qr",
            "status": "completed",
            "created_at": datetime(2026, 4, 23, 4, 16, 31, tzinfo=timezone.utc),
            "completed_at": datetime(2026, 4, 23, 4, 17, 10, tzinfo=timezone.utc),
            "rrn": "647997823739",
            "contact": "+91XXXXXXXXXX",
            "order_notes": "[RECOVERED] QR Payment pay_SgtEexkhic41Ot - \u20b9550"
        },
        {
            "razorpay_payment_id": "pay_SgqDRBynweIvDK",
            "user_id": 69,
            "user_email": "sangeetakapoor3004@gmail.com",
            "amount": Decimal("799.00"),
            "payment_method": "card",
            "status": "completed",
            "created_at": datetime(2026, 4, 7, 9, 37, 47, tzinfo=timezone.utc),
            "completed_at": datetime(2026, 4, 23, 1, 20, 18, tzinfo=timezone.utc),
            "rrn": "611306158207",
            "contact": "+918297710833",
            "order_notes": "[RECOVERED] Card Payment pay_SgqDRBynweIvDK - \u20b9799"
        }
    ]
    
    print(f"\n🔧 Starting fix at {datetime.now(timezone.utc)}")
    print(f"🔧 Fixing {len(missing_payments)} missing payments\n")
    
    created_orders = []
    created_payments = []
    
    for idx, payment_data in enumerate(missing_payments):
        try:
            invoice_number = invoices[idx]
            
            # Step 1: Create PaymentTransaction if missing
            existing_pt = db.query(PaymentTransaction).filter(
                PaymentTransaction.razorpay_payment_id == payment_data["razorpay_payment_id"]
            ).first()
            
            if existing_pt:
                pt = existing_pt
                created_payments.append(("exists", pt.id))
                print(f"✅ [{idx+1}/4] Payment {payment_data['razorpay_payment_id']} already exists as PT #{pt.id}")
            else:
                pt = PaymentTransaction(
                    user_id=payment_data["user_id"],
                    amount=payment_data["amount"],
                    currency="INR",
                    payment_method=payment_data["payment_method"],
                    transaction_id=payment_data["razorpay_payment_id"],
                    razorpay_payment_id=payment_data["razorpay_payment_id"],
                    status=payment_data["status"],
                    completed_at=payment_data["completed_at"],
                    created_at=payment_data["created_at"],
                    gateway_response={
                        "email": payment_data.get("user_email"),
                        "contact": payment_data.get("contact"),
                        "rrn": payment_data.get("rrn"),
                        "recovered": True,
                        "recovery_date": datetime.now(timezone.utc).isoformat()
                    }
                )
                db.add(pt)
                db.flush()
                db.refresh(pt)
                created_payments.append(("new", pt.id))
                print(f"🆕 [{idx+1}/4] Created PaymentTransaction #{pt.id} for {payment_data['razorpay_payment_id']}")
            
            # Step 2: Create Order
            existing_order = db.query(Order).filter(
                Order.razorpay_payment_id == payment_data["razorpay_payment_id"]
            ).first()
            
            if existing_order:
                print(f"✅ [{idx+1}/4] Order already exists #{existing_order.id}")
                created_orders.append(("exists", existing_order.id))
                if pt.order_id != existing_order.id:
                    pt.order_id = existing_order.id
                    db.commit()
                    print(f"   └─ Linked PT #{pt.id} to existing Order #{existing_order.id}")
                continue
            
            order = Order(
                user_id=payment_data["user_id"],
                transaction_id=payment_data["razorpay_payment_id"],
                razorpay_payment_id=payment_data["razorpay_payment_id"],
                invoice_number=invoice_number,
                subtotal=payment_data["amount"],
                total_amount=payment_data["amount"],
                shipping_cost=Decimal("0"),
                gst_amount=Decimal("0"),
                discount_applied=Decimal("0"),
                payment_method=payment_data["payment_method"],
                status=OrderStatus.CONFIRMED,
                order_notes=payment_data["order_notes"],
                shipping_address=f"Address to be confirmed - Recovered payment {payment_data['razorpay_payment_id']}",
                created_at=payment_data["created_at"],
                updated_at=payment_data["created_at"]
            )
            db.add(order)
            db.flush()
            db.refresh(order)
            created_orders.append(("new", order.id))
            print(f"🆕 [{idx+1}/4] Created Order #{order.id} for {payment_data['razorpay_payment_id']}")
            
            # Link PaymentTransaction to Order
            pt.order_id = order.id
            db.commit()
            print(f"   └─ Linked PT #{pt.id} to Order #{order.id}")
            
            # Step 3: Create OrderItem
            item = OrderItem(
                order_id=order.id,
                product_name="Aarya Clothing Purchase - Recovered",
                sku=f"RECOVERED-{payment_data['razorpay_payment_id'][-8:]}",
                quantity=1,
                unit_price=payment_data["amount"],
                price=payment_data["amount"],
                size="One Size",
                color="Not Specified"
            )
            db.add(item)
            db.commit()
            print(f"   └─ Created OrderItem for ₹{payment_data['amount']}\n")
            
        except Exception as e:
            db.rollback()
            import traceback
            print(f"❌ [{idx+1}/4] ERROR for {payment_data['razorpay_payment_id']}: {e}\n")
            traceback.print_exc()
            continue
    
    print("=" * 80)
    print("📊 VERIFICATION")
    print("=" * 80)
    
    orphaned = db.query(PaymentTransaction).filter(
        PaymentTransaction.status == "completed",
        PaymentTransaction.order_id.is_(None)
    ).count()
    print(f"\n✅ Completed payments with NO order: {orphaned} (should be 0)")
    
    total_orders = db.query(Order).count()
    new_orders_count = len([o for o in created_orders if o[0] == 'new'])
    print(f"✅ Total orders: {total_orders} (was ~35, now {35 + new_orders_count})")
    
    for payment_data in missing_payments:
        pt = db.query(PaymentTransaction).filter(
            PaymentTransaction.razorpay_payment_id == payment_data["razorpay_payment_id"]
        ).first()
        if pt:
            order = db.query(Order).filter(Order.id == pt.order_id).first() if pt.order_id else None
            status = "✅" if order else "❌"
            print(f"\n   {status} {payment_data['razorpay_payment_id']}: PT#{pt.id} -> Order#{order.id if order else 'NONE'}")
        else:
            print(f"\n   ❌ {payment_data['razorpay_payment_id']}: NOT FOUND")
    
    db.close()
    
    print("\n" + "=" * 80)
    print("✅ FIX COMPLETE!")
    print("=" * 80)

if __name__ == "__main__":
    main()
