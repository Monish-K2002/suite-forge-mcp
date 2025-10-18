"use client"

import React, { useState } from 'react';
import styles from './Chatbot.module.css';

import { FiSend, FiMoon, FiSun } from 'react-icons/fi';

interface ChatbotProps {
  onSendMessage: (message: string) => Promise<string>;
}

const Chatbot: React.FC<ChatbotProps> = ({ onSendMessage }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [messages, setMessages] = useState<{ text: string; sender: 'user' | 'bot' }[]>([]);
  const [inputValue, setInputValue] = useState('');

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleSendMessage = async () => {
    if (inputValue.trim() === '') return;
    const userMessage = inputValue;
    setMessages((prevMessages) => [...prevMessages, { text: userMessage, sender: 'user' }]);
    setInputValue('');
    const botResponse = await onSendMessage(userMessage);
    setMessages((prevMessages) => [...prevMessages, { text: botResponse, sender: 'bot' }]);
  };

  return (
    <div className={`${styles.chatbotContainer} ${isDarkMode ? styles.darkMode : ''}`}>
      <div className={styles.header}>
        <h2>NetSuite MCP Connector</h2>
        <button onClick={toggleDarkMode} className={styles.toggleButton}>
          {isDarkMode ? <FiSun /> : <FiMoon />}
        </button>
      </div>
      <div className={styles.messageList}>
        {messages.map((message, index) => (
          <div key={index} className={`${styles.message} ${styles[message.sender]}`}>
            {message.text}
          </div>
        ))}
      </div>
      <div className={styles.inputContainer}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type your message..."
        />
        <button onClick={handleSendMessage}><FiSend /></button>
      </div>
      
    </div>
  );
};

export default Chatbot;