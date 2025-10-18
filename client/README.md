# NetSuite AI Chatbot

A modern, responsive chat interface for NetSuite AI integration built with Next.js 15, React 19, and Tailwind CSS.

## Features

### 🎨 Modern UI Design
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Dark/Light Mode**: Automatic theme switching based on system preferences
- **Smooth Animations**: Fade-in effects for messages and typing indicators
- **Custom Scrollbar**: Styled scrollbar for better visual appeal

### 💬 Chat Interface
- **Message Bubbles**: Distinct styling for user and assistant messages
- **Typing Indicators**: Animated dots showing when the AI is responding
- **Message Status**: Visual indicators for sending, sent, and error states
- **Auto-scroll**: Automatically scrolls to new messages
- **Keyboard Shortcuts**: Press Enter to send, Shift+Enter for new lines

### 🚀 NetSuite Integration
- **AI Connector**: Ready-to-integrate NetSuite AI connector with mock implementation
- **Quick Actions**: Pre-defined buttons for common NetSuite tasks
- **Error Handling**: Graceful error handling with user-friendly messages
- **Connection Status**: Visual indicator showing connection status

### 🎯 Quick Actions
- Show inventory levels
- Generate sales report
- Find customer information
- Check recent transactions
- Help with NetSuite setup

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Navigate to the client directory:
```bash
cd client
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
client/
├── app/
│   ├── components/
│   │   └── NetSuiteConnector.tsx    # NetSuite AI connector logic
│   ├── globals.css                  # Global styles and animations
│   ├── layout.tsx                   # Root layout component
│   └── page.tsx                     # Main chat interface
├── public/                          # Static assets
└── package.json                     # Dependencies and scripts
```

## NetSuite AI Connector

The `NetSuiteConnector` class provides a clean interface for integrating with NetSuite AI services:

```typescript
const connector = new NetSuiteConnector(apiEndpoint, apiKey);
const response = await connector.sendMessage("Show me inventory levels");
```

### Mock Implementation

For development and testing, a mock implementation is included that simulates NetSuite AI responses based on message content.

## Customization

### Styling
- Modify `globals.css` for custom animations and styles
- Update Tailwind classes in components for different color schemes
- Add custom CSS variables for theming

### NetSuite Integration
- Replace the mock implementation with actual NetSuite API calls
- Add authentication and authorization logic
- Implement data fetching and processing functions

### Features
- Add file upload capabilities
- Implement message search and history
- Add user authentication
- Create conversation persistence

## Technologies Used

- **Next.js 15**: React framework with App Router
- **React 19**: Latest React features and hooks
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **Geist Font**: Modern typography

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.