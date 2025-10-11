# DormGlide - Founder's Customer Management Guide

## 🎯 Overview

This guide will help you understand how to manage your customers, view their activity, and maintain the DormGlide platform as a founder/administrator.

## 🔐 Admin Access

### Logging In as Admin
1. Open the app (app.html)
2. Click "Login / Sign Up" in the header
3. Use the admin credentials:
   - **Email:** admin@dormglide.com
   - **Password:** admin123

### Accessing Admin Dashboard
Once logged in as admin, you can access the admin dashboard in two ways:
1. **Via User Menu:** Click your name in the header → "Admin Panel"
2. **Direct Navigation:** The admin button will appear in your user menu

## 👥 Customer Management

### Viewing All Customers

The Admin Dashboard provides comprehensive customer information:

1. **Overview Tab:**
   - Total users count
   - Active users count
   - Total listings on platform
   - Platform total value

2. **Users Tab:**
   - Complete list of all registered users
   - Search functionality by name or email
   - Filter by status (Active/Suspended)
   - User activity summary (sales, purchases, views)

### User Information Available

For each customer, you can see:
- **Basic Info:** Name, Email, Phone
- **Role:** User (buyer) or Seller
- **Join Date:** When they created their account
- **Activity Stats:**
  - Number of sales made
  - Number of purchases
  - Product views
  - Favorites saved
- **Status:** Active, Suspended, or Deleted
- **Rating:** User rating (if implemented)

### Managing Individual Customers

**To Suspend a User:**
1. Go to Admin Dashboard → Users tab
2. Find the user in the table
3. Click the ban icon (🚫) button
4. Confirm the suspension

**To Activate a User:**
1. Find suspended user in the table
2. Click the check icon (✓) button
3. User will be reactivated

**To View Detailed Activity:**
1. Each user's row shows their activity summary
2. Click on the info icon (ℹ️) for more details

## 📊 Customer Activity Tracking

### What Gets Tracked

The system automatically tracks:

1. **Views:** Every time a user views a product
2. **Purchases:** When a user completes a purchase
3. **Sales:** When a seller completes a sale
4. **Favorites:** Items saved by users
5. **Messages:** Communication between users (future feature)
6. **Searches:** What users search for

### Accessing Activity Data

**For Individual Users:**
```javascript
// In browser console (F12)
const activity = window.DormGlideAuth.getUserActivity('user_id_here');
console.log(activity);
```

**For All Users:**
```javascript
const allUsers = window.DormGlideAuth.getAllUsersForAdmin();
console.log(allUsers);
```

## 🛍️ Product Management

### Managing Listings

1. **View All Products:**
   - Admin Dashboard → Products tab
   - See all listings with seller information

2. **Delete Inappropriate Content:**
   - Find the product in the grid
   - Click "Delete" button
   - Confirm deletion

### Monitoring Product Activity

Each product listing shows:
- Seller information
- Price and category
- Upload date
- View count (if tracked)

## 📈 Platform Analytics

### Key Metrics to Monitor

1. **User Growth:**
   - Total registered users
   - New users per week/month
   - Active vs inactive users

2. **Transaction Volume:**
   - Total listings
   - Completed sales
   - Average transaction value

3. **User Engagement:**
   - Products viewed
   - Favorites saved
   - Search frequency

### Exporting Data

**To Export User Data:**
```javascript
// Open browser console (F12)
const users = window.DormGlideAuth.getAllUsersForAdmin();
console.table(users); // View in table format

// Export to JSON
const dataStr = JSON.stringify(users, null, 2);
const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
const exportFileDefaultName = 'dormglide-users.json';
const linkElement = document.createElement('a');
linkElement.setAttribute('href', dataUri);
linkElement.setAttribute('download', exportFileDefaultName);
linkElement.click();
```

**To Export Product Data:**
```javascript
const products = getProductsFromStorage();
console.table(products);

// Export to JSON
const dataStr = JSON.stringify(products, null, 2);
const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
const linkElement = document.createElement('a');
linkElement.setAttribute('href', dataUri);
linkElement.setAttribute('download', 'dormglide-products.json');
linkElement.click();
```

## 🔍 Customer Support

### Handling User Issues

1. **Account Problems:**
   - Check user status in Admin Dashboard
   - Verify email and account details
   - Reactivate if suspended accidentally

2. **Transaction Disputes:**
   - View both buyer and seller activity
   - Check transaction timestamps
   - Review product details

3. **Inappropriate Content:**
   - Delete offending products
   - Suspend repeat offenders
   - Document violations

### Communication Channels

Based on your footer, support is available via:
- **Instagram:** @dormglide
- **Business Inquiries:** Through Instagram DMs

## 🔒 Data Privacy & Security

### User Data Storage

- All data is stored in browser localStorage
- No external server currently (for demo)
- Users can delete their own accounts

### GDPR Compliance (Future)

When scaling, consider:
- User data export features
- Right to deletion
- Data retention policies
- Privacy policy updates

## 🚀 Scaling Recommendations

### When You're Ready to Scale:

1. **Move to Real Database:**
   - Set up MongoDB, PostgreSQL, or Firebase
   - Migrate from localStorage to server storage
   - Implement proper authentication (JWT, OAuth)

2. **Add Email Notifications:**
   - Account creation confirmations
   - Sale/purchase notifications
   - Activity summaries

3. **Implement Payment Processing:**
   - Stripe or PayPal integration
   - Escrow services for safety
   - Transaction fees for revenue

4. **Enhanced Analytics:**
   - Google Analytics integration
   - Custom dashboard with charts
   - Revenue tracking

5. **Mobile App:**
   - React Native version
   - Push notifications
   - Camera integration for product photos

## 📞 Emergency Procedures

### If You Need to Reset Everything:

```javascript
// Open browser console (F12)
window.DormGlideStorage.clearAllData();
location.reload();
```

### If You Need to Remove Specific User:

```javascript
// Get all users
const users = localStorage.getItem('dormglide_users');
const userArray = JSON.parse(users);

// Remove specific user (by email)
const updatedUsers = userArray.filter(u => u.email !== 'user@email.com');

// Save back
localStorage.setItem('dormglide_users', JSON.stringify(updatedUsers));
location.reload();
```

## 📋 Best Practices

1. **Regular Monitoring:**
   - Check admin dashboard daily
   - Review new listings
   - Monitor user reports

2. **Community Guidelines:**
   - Set clear rules for listings
   - Enforce consistently
   - Communicate with users

3. **Safety First:**
   - Promote safe meeting locations
   - Encourage secure payments
   - Verify student status when possible

4. **Growth Strategy:**
   - Start with one campus
   - Gather feedback actively
   - Iterate based on user needs

## 🎓 Demo Accounts

For testing purposes, these accounts are created automatically:

**Admin Account:**
- Email: admin@dormglide.com
- Password: admin123

**Demo User Account:**
- Email: test@demo.com
- Password: password

You can create more test accounts as needed!

## 📚 Technical Details

### File Structure:
```
/js/utils/
  - auth.js (Authentication system)
  - storage.js (Data management)
  - sampleData.js (Demo data)

/js/components/
  - AuthModal.js (Login/Signup UI)
  - Header.js (Navigation)
  - etc.

/js/pages/
  - AdminDashboard.js (Admin panel)
  - UserDashboard.js (User activity)
  - etc.
```

### Key Functions:
- `getAllUsersForAdmin()` - Get all users with activity
- `suspendUser(adminId, userId)` - Suspend a user
- `activateUser(adminId, userId)` - Activate a user
- `getUserActivity(userId)` - Get user activity details
- `trackPurchase()` - Record a purchase
- `trackSale()` - Record a sale

## 💡 Tips for Success

1. **Start Small:** Focus on quality over quantity initially
2. **Engage Users:** Respond quickly to feedback
3. **Build Trust:** Verify users, encourage ratings
4. **Stay Safe:** Always prioritize user safety
5. **Iterate Fast:** Use feedback to improve quickly

## 📞 Support

For technical issues or questions about managing the platform:
- Check this guide first
- Review the code comments
- Test in demo mode before making changes
- Keep backups of important data

---

**Remember:** You're building a community, not just a marketplace. Focus on creating a safe, trustworthy environment where students feel comfortable trading with each other!

Good luck with DormGlide! 🚀🏠
