# DormGlide 🏠📱

A modern marketplace platform where students can safely buy and sell their used goods. Built with React and designed to work seamlessly on both laptops and mobile devices.

## 🌟 Features

### 🛒 **Marketplace Functionality**
- **Browse Products**: View all available items with advanced search and filtering
- **Product Details**: Detailed product pages with image galleries and seller information
- **Sell Items**: Easy-to-use form for listing items with photo upload
- **Categories**: Organized by Electronics, Textbooks, Furniture, Clothing, Sports, Kitchen, and more

### 📱 **Responsive Design**
- **Mobile-First**: Optimized for smartphones and tablets
- **Desktop Support**: Full functionality on laptops and desktops
- **Touch-Friendly**: Large buttons and touch-optimized interactions
- **Adaptive Layout**: Content adjusts beautifully to any screen size

### 👤 **User Management**
- **Profile System**: Create and manage user profiles
- **My Listings**: Track and manage your posted items
- **Contact System**: Built-in messaging for buyer-seller communication
- **Safety Features**: Tips and guidelines for safe transactions

### 🔍 **Search & Discovery**
- **Advanced Search**: Search by title, description, and category
- **Price Filtering**: Filter by price range and condition
- **Category Navigation**: Quick access to specific item categories
- **Featured Items**: Highlighted products on the homepage

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- Modern web browser
- Text editor (VS Code recommended)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd DormGlide
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000`

## 📁 Project Structure

```
DormGlide/
├── index.html              # Main HTML file
├── package.json            # Project dependencies
├── styles/
│   └── main.css            # All application styles
├── js/
│   ├── App.js              # Main application component
│   ├── components/         # Reusable React components
│   │   ├── Header.js       # Navigation header
│   │   ├── Footer.js       # Footer component
│   │   ├── ProductCard.js  # Product display cards
│   │   ├── ProductGrid.js  # Product grid layout
│   │   └── SearchFilter.js # Search and filter controls
│   ├── pages/              # Main application pages
│   │   ├── HomePage.js     # Homepage with featured items
│   │   ├── ProductDetailPage.js # Individual product view
│   │   ├── SellPage.js     # Item listing form
│   │   └── ProfilePage.js  # User profile and listings
│   └── utils/              # Utility functions
│       ├── storage.js      # LocalStorage management
│       └── sampleData.js   # Demo data and initialization
└── images/                 # Static images (placeholder directory)
```

## 🛠 Technology Stack

- **Frontend Framework**: React 18 (via CDN)
- **Styling**: Custom CSS with mobile-first responsive design
- **Icons**: Font Awesome 6
- **Build Tool**: Babel Standalone for JSX transformation
- **Development Server**: http-server
- **Data Storage**: Browser LocalStorage (for demo purposes)

## 📱 Mobile Optimization

DormGlide is built with a mobile-first approach:

### Mobile Features:
- **Responsive Navigation**: Collapsible hamburger menu
- **Touch Interactions**: Large tap targets and swipe gestures
- **Optimized Images**: Fast loading and properly sized images
- **Mobile Forms**: Touch-friendly form inputs and buttons
- **Offline Support**: Data persistence with LocalStorage

### Screen Compatibility:
- **Phone**: 320px - 768px (Primary focus)
- **Tablet**: 768px - 1024px
- **Desktop**: 1024px and above

## 🔧 Key Components

### HomePage
- Hero section with call-to-action
- Category quick navigation
- Search and filter functionality
- Featured and all products display

### ProductDetailPage
- Image gallery with zoom functionality
- Detailed product information
- Seller contact and purchase options
- Related items suggestions

### SellPage
- Multi-step item listing form
- Image upload with preview
- Category and condition selection
- Safety tips for sellers

### ProfilePage
- User profile management
- Personal listings dashboard
- Account settings and preferences

## 💾 Data Management

The application uses browser LocalStorage for data persistence:

- **Products**: All marketplace listings
- **User Profiles**: Account information and preferences
- **Search History**: Recent searches for quick access
- **App Preferences**: Theme and notification settings

## 🎨 Design System

### Color Palette:
- **Primary**: #007bff (Blue)
- **Secondary**: #6c757d (Gray)
- **Success**: #28a745 (Green)
- **Danger**: #dc3545 (Red)
- **Warning**: #ffc107 (Yellow)

### Typography:
- **Font Family**: System fonts (-apple-system, BlinkMacSystemFont, Segoe UI)
- **Responsive Sizing**: Scales appropriately across devices
- **Accessibility**: High contrast and readable font sizes

## 🔒 Safety Features

DormGlide prioritizes student safety:

- **Public Meeting Reminders**: Encourages safe meetup locations
- **Identity Verification**: Student email integration
- **Safe Payment**: Guidelines for secure transactions
- **Trust Indicators**: User ratings and review system
- **Report System**: Easy reporting of suspicious activity

## 🚀 Usage Examples

### For Buyers:
1. Browse items by category or search
2. View detailed product information
3. Contact seller through the platform
4. Arrange safe meetup for transaction

### For Sellers:
1. Create account with student email
2. List items with photos and descriptions
3. Set competitive prices
4. Manage listings through profile dashboard

## 🔄 Future Enhancements

Potential features for future development:

- **Real-time Messaging**: In-app chat system
- **Payment Integration**: Secure online payments
- **Push Notifications**: Alert users about new listings
- **Advanced Analytics**: Sales insights and trends
- **Social Features**: User reviews and recommendations
- **Mobile App**: Native iOS and Android applications

## 🤝 Contributing

This project is designed for educational purposes and student use. To contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on multiple devices
5. Submit a pull request

## 📄 License

MIT License - feel free to use this project for educational purposes.

## 🆘 Support

For questions or issues:
- Check browser console for error messages
- Ensure JavaScript is enabled
- Verify LocalStorage is available
- Test on different devices and browsers

## 🌟 Inspiration

DormGlide is inspired by popular marketplace apps like:
- **Mercari** (Japan) - User-friendly mobile marketplace
- **Carrot Market** (Korea) - Location-based trading
- **Facebook Marketplace** - Social commerce
- **OfferUp** - Mobile-first design

Built specifically for the unique needs of college students! 🎓
