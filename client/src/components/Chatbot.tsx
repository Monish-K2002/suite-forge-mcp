import React, { useState, useRef, useEffect } from 'react';
import styles from './Chatbot.module.css';

import { FiSend, FiMoon, FiSun, FiPlus, FiClock } from 'react-icons/fi';

interface ChatbotProps {
  onSendMessage: (message: string) => Promise<string>;
  toggleHistory: () => void;
}

import { useDarkMode } from '../contexts/DarkModeContext';

const Chatbot: React.FC<ChatbotProps> = ({ onSendMessage, toggleHistory }) => {
  const { isDarkMode } = useDarkMode();
  const [messages, setMessages] = useState<{ text: string; sender: 'user' | 'bot' }[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachmentButtonRef = useRef<HTMLButtonElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (attachmentButtonRef.current && !attachmentButtonRef.current.contains(event.target as Node)) {
        setShowAttachmentMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSendMessage = async () => {
    if (inputValue.trim() === '') return;
    const userMessage = inputValue;
    setMessages((prevMessages) => [...prevMessages, { text: userMessage, sender: 'user' }]);
    setInputValue('');
    const botResponse = await onSendMessage(userMessage);
    setMessages((prevMessages) => [...prevMessages, { text: botResponse, sender: 'bot' }]);
  };

  const handleAttachmentClick = () => {
    setShowAttachmentMenu(!showAttachmentMenu);
  };

  return (
    <div className={`${styles.chatbotContainer} ${isDarkMode ? styles.darkMode : ''}`}>
      <div className={styles.header}>
        <button onClick={toggleHistory} className={styles.historyButton}><FiClock /></button>
        <h2>NetSuite MCP Connector</h2>
      </div>
      <div ref={messageListRef} className={styles.messageList}>
        {messages.map((message, index) => (
          <div key={index} className={`${styles.message} ${styles[message.sender]}`}>
            {message.text}
          </div>
        ))}
      </div>
      <div className={styles.inputContainer}>
        <div className={styles.attachmentContainer}>
          <button ref={attachmentButtonRef} onClick={handleAttachmentClick} className={styles.attachmentButton}><FiPlus /></button>
          {showAttachmentMenu && (
            <div className={styles.attachmentMenu}>
              <ul>
                <li>Feature coming soon</li>
              </ul>
            </div>
          )}
        </div>
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
          placeholder="Type your message..."
          rows={1}
        />
        <button onClick={handleSendMessage}><FiSend /></button>
      </div>
      
    </div>
  );
};

export default Chatbot;