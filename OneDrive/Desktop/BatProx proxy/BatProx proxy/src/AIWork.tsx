import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import Cookies from 'js-cookie';

interface ChatHistory {
  id: string;
  title: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  timestamp: number;
  checkpoints?: Array<{ id: string; messageIndex: number; timestamp: number }>;
}

export default function AIWork() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; chatId: string } | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingContent, setTypingContent] = useState('');
  const [images, setImages] = useState<Array<{ id: string; data: string; file: File }>>([]);
  const [stopTyping, setStopTyping] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pausedContent, setPausedContent] = useState('');
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [checkpoints, setCheckpoints] = useState<Array<{ id: string; messageIndex: number; timestamp: number }>>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [expandedChats, setExpandedChats] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load settings for typing animation
  const [disableTypingAnimation, setDisableTypingAnimation] = useState(false);
  
  useEffect(() => {
    const savedSettings = localStorage.getItem('batprox-settings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setDisableTypingAnimation(settings.disableTypingAnimation || false);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingContent]);

  useEffect(() => {
    const savedHistory = Cookies.get('chatHistory');
    if (savedHistory) {
      try {
        setChatHistory(JSON.parse(savedHistory));
      } catch (error) {
        console.error('Error parsing chat history from cookies:', error);
      }
    }
  }, []);

  useEffect(() => {
    Cookies.set('chatHistory', JSON.stringify(chatHistory), { expires: 365 });
  }, [chatHistory]);

  const saveChatToHistory = (messagesToSave?: Array<{ role: 'user' | 'assistant'; content: string }>) => {
    const messagesArray = messagesToSave || messages;
    if (messagesArray.length === 0) return;
    
    const title = messagesArray[0]?.content.substring(0, 30) + (messagesArray[0]?.content.length > 30 ? '...' : '') || 'New Chat';
    const newChat: ChatHistory = {
      id: currentChatId || Date.now().toString(),
      title,
      messages: messagesArray,
      timestamp: Date.now(),
      checkpoints
    };
    
    if (currentChatId) {
      setChatHistory(prev => {
        const updated = prev.map(chat => chat.id === currentChatId ? newChat : chat);
        Cookies.set('chatHistory', JSON.stringify(updated), { expires: 365 });
        return updated;
      });
    } else {
      setChatHistory(prev => {
        const updated = [newChat, ...prev];
        Cookies.set('chatHistory', JSON.stringify(updated), { expires: 365 });
        setCurrentChatId(newChat.id);
        return updated;
      });
    }
  };

  const loadChat = (chatId: string) => {
    const chat = chatHistory.find(c => c.id === chatId);
    if (chat) {
      setMessages(chat.messages);
      setCurrentChatId(chatId);
      setCheckpoints(chat.checkpoints || []);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentChatId(null);
    setCheckpoints([]);
  };

  const deleteChat = (chatId: string) => {
    setChatHistory(prev => {
      const newHistory = prev.filter(chat => chat.id !== chatId);
      Cookies.set('chatHistory', JSON.stringify(newHistory), { expires: 365 });
      return newHistory;
    });
    if (currentChatId === chatId) {
      startNewChat();
    }
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent, chatId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, chatId });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageItems = Array.from(items).filter(item => item.type.startsWith('image/'));
    
    imageItems.forEach(item => {
      const file = item.getAsFile();
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          setImages(prev => [...prev, { id: Date.now().toString(), data: dataUrl, file }]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (message.trim() || images.length > 0) {
      const userMessage = message.trim();
      const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
      setMessages(newMessages);
      setMessage('');
      setIsTyping(true);
      setTypingContent('');
      setStopTyping(false);
      setIsPaused(false);
      const currentImages = [...images];
      setImages([]);
      
      // Create checkpoint after user message
      const newCheckpoint = {
        id: Date.now().toString(),
        messageIndex: newMessages.length - 1,
        timestamp: Date.now()
      };
      setCheckpoints(prev => [...prev, newCheckpoint]);

      try {
        const formData = new FormData();
        formData.append('message', userMessage);
        currentImages.forEach((img) => {
          formData.append('images', img.file);
        });

        const response = await fetch('http://localhost:3000/api/ai/chat', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Failed to get AI response');
        }

        const data = await response.json();
        const aiResponse = data.response;
        
        if (disableTypingAnimation) {
          // Instant response without typing animation
          const finalMessages = [...messages, { role: 'assistant' as const, content: aiResponse }];
          setMessages(finalMessages);
          setIsTyping(false);
          saveChatToHistory(finalMessages);
        } else {
          // Typing animation
          let index = 0;
          typingIntervalRef.current = setInterval(() => {
            if (stopTyping) {
              clearInterval(typingIntervalRef.current!);
              setIsTyping(false);
              setPausedContent(typingContent);
              setIsPaused(true);
              return;
            }
            
            if (index < aiResponse.length) {
              setTypingContent(aiResponse.substring(0, index + 1));
              index++;
            } else {
              clearInterval(typingIntervalRef.current!);
              setIsTyping(false);
              const finalMessages = [...messages, { role: 'assistant' as const, content: aiResponse }];
              setMessages(finalMessages);
              setTypingContent('');
              setIsPaused(false);
              // Save chat after AI responds
              saveChatToHistory(finalMessages);
            }
          }, 15); // Speed of typing
        }
      } catch (error) {
        console.error('Error sending message:', error);
        setIsTyping(false);
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'Sorry, I encountered an error. Please try again.' 
        }]);
      }
    }
  };

  const handleStopTyping = () => {
    setStopTyping(true);
  };

  const handleContinueTyping = () => {
    setIsPaused(false);
    setStopTyping(false);
    setIsTyping(true);
    
    // Get the last AI message to continue from
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant') {
      const fullResponse = lastMessage.content;
      const startIndex = pausedContent.length;
      
      let index = startIndex;
      typingIntervalRef.current = setInterval(() => {
        if (stopTyping) {
          clearInterval(typingIntervalRef.current!);
          setIsTyping(false);
          setPausedContent(typingContent);
          setIsPaused(true);
          return;
        }
        
        if (index < fullResponse.length) {
          setTypingContent(fullResponse.substring(0, index + 1));
          index++;
        } else {
          clearInterval(typingIntervalRef.current!);
          setIsTyping(false);
          setTypingContent('');
          setIsPaused(false);
          saveChatToHistory(messages);
        }
      }, 15);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden font-sans text-white">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute inset-0 bg-repeat opacity-60"
          style={{
            backgroundImage: `radial-gradient(1px 1px at 20px 30px, #fff, rgba(0,0,0,0)), 
                              radial-gradient(1.5px 1.5px at 40px 70px, #fff, rgba(0,0,0,0)), 
                              radial-gradient(1px 1px at 90px 40px, #fff, rgba(0,0,0,0)), 
                              radial-gradient(2px 2px at 160px 120px, #ddd, rgba(0,0,0,0)),
                              radial-gradient(1.5px 1.5px at 230px 190px, #fff, rgba(0,0,0,0)),
                              radial-gradient(1px 1px at 300px 80px, #fff, rgba(0,0,0,0))`,
            backgroundSize: '350px 350px',
          }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 sm:w-96 sm:h-96 bg-purple-600/30 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-purple-400/20 rounded-full blur-[60px] pointer-events-none" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Navbar */}
        <div className="w-full flex justify-center py-4 relative z-30">
          <div className="flex gap-3 px-10 py-3 rounded-2xl bg-black/60 border border-white/20 backdrop-blur-2xl shadow-2xl w-full max-w-6xl mx-4 justify-end items-center">
            {/* Chat History Dropdown */}
            <div className="relative mr-4">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="px-6 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 transition-all text-sm font-medium hover:scale-105 shadow-lg flex items-center gap-2"
              >
                <span>Chat History</span>
                <svg className={`w-4 h-4 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Dropdown Content */}
              {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-80 max-h-96 overflow-y-auto bg-black/90 border border-white/20 rounded-xl backdrop-blur-xl shadow-2xl transition-all duration-300 ease-out z-50">
                  <div className="p-4 border-b border-white/10">
                    <button 
                      onClick={startNewChat}
                      className="w-full px-4 py-3 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 transition-all text-sm font-medium shadow-lg"
                    >
                      + New Chat
                    </button>
                  </div>
                  <div className="p-3 space-y-2">
                    {chatHistory.length === 0 ? (
                      <div className="text-center text-gray-500 text-sm py-4">
                        No chat history
                      </div>
                    ) : (
                      chatHistory.map((chat) => (
                        <div key={chat.id}>
                          <div
                            onContextMenu={(e) => handleContextMenu(e, chat.id)}
                            onClick={() => {
                              loadChat(chat.id);
                              setExpandedChats(prev => {
                                const newSet = new Set(prev);
                                if (newSet.has(chat.id)) {
                                  newSet.delete(chat.id);
                                } else {
                                  newSet.add(chat.id);
                                }
                                return newSet;
                              });
                            }}
                            className={`px-4 py-3 rounded-xl cursor-pointer transition-all text-sm truncate flex items-center justify-between ${
                              currentChatId === chat.id 
                                ? 'bg-purple-600/40 border border-purple-500/50 text-white shadow-md' 
                                : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-transparent hover:border-white/20'
                            }`}
                          >
                            <span>{chat.title}</span>
                            <svg className={`w-4 h-4 transition-transform duration-300 ${expandedChats.has(chat.id) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                          {/* Checkpoints for expanded chat */}
                          {expandedChats.has(chat.id) && chat.checkpoints && chat.checkpoints.length > 0 && (
                            <div className="ml-4 mt-2 space-y-1 animate-in slide-in-from-top-2 duration-300">
                              {chat.checkpoints.map((checkpoint, index) => (
                                <div
                                  key={checkpoint.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    loadChat(chat.id);
                                    const checkpointsList = chat.checkpoints || [];
                                    setCheckpoints(checkpointsList);
                                    const messagesAtCheckpoint = chat.messages.slice(0, checkpoint.messageIndex + 1);
                                    setMessages(messagesAtCheckpoint);
                                    setCheckpoints(checkpointsList.slice(0, index + 1));
                                    setIsDropdownOpen(false);
                                  }}
                                  className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-blue-500/20 transition-all group"
                                >
                                  <div className="w-0.5 h-4 bg-blue-400 rounded-full" />
                                  <span className="text-xs text-blue-300 group-hover:text-blue-200">
                                    Checkpoint {index + 1}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => navigate('/')}
              className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-sm font-medium hover:scale-105 shadow-lg"
            >
              &lt; Go back
            </button>
            
            <button className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-sm font-medium hover:scale-105 shadow-lg">
              Settings
            </button>
            <button 
              onClick={() => navigate('/more-games')}
              className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-sm font-medium hover:scale-105 shadow-lg"
            >
              More Games
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* Chat Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Chat Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-8 max-w-4xl mx-auto w-full pb-32">
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="text-center text-gray-400 mt-20">
                    <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 mb-4">
                      MocahAI
                    </h2>
                    <p className="text-lg">Ask me anything...</p>
                  </div>
                )}
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                        msg.role === 'user'
                          ? 'bg-purple-600/30 border border-purple-500/30 text-white'
                          : 'bg-white/10 border border-white/20 text-gray-200'
                      } backdrop-blur-md`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-invert max-w-none">
                          <ReactMarkdown>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] px-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-gray-200 backdrop-blur-md">
                      <div className="prose prose-invert max-w-none">
                        <ReactMarkdown>
                          {typingContent}
                        </ReactMarkdown>
                        <span className="inline-block w-2 h-4 bg-purple-400 ml-1 animate-pulse" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area */}
            <div className="fixed bottom-0 left-0 right-0 w-full flex justify-center pb-8 bg-gradient-to-t from-black/90 via-black/70 to-transparent pt-6 z-20">
              <div className="w-full max-w-2xl px-4">
                {/* Image Preview Area */}
                {images.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {images.map((img) => (
                      <div key={img.id} className="relative group">
                        <img
                          src={img.data}
                          alt="Preview"
                          className="w-20 h-20 object-cover rounded-lg border border-white/20"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(img.id)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <form onSubmit={handleSendMessage} className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder="Ask MocahAI anything.."
                    className="w-full px-6 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all duration-300 backdrop-blur-md text-center shadow-2xl py-4 text-lg"
                  />
                  
                  {/* Stop Button */}
                  {isTyping && (
                    <button
                      type="button"
                      onClick={handleStopTyping}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-red-500/90 hover:bg-red-600 rounded-lg transition-all duration-300 shadow-lg z-30 flex items-center justify-center"
                    >
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="6" width="12" height="12" rx="1" />
                      </svg>
                    </button>
                  )}
                  
                  {/* Continue Button */}
                  {isPaused && (
                    <button
                      type="button"
                      onClick={handleContinueTyping}
                      className="absolute right-4 top-1/2 -translate-y-1/2 px-3 py-1 bg-green-500/90 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-all duration-300 shadow-lg z-30"
                    >
                      Continue
                    </button>
                  )}
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-black/90 border border-white/20 rounded-xl shadow-2xl backdrop-blur-md"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={() => setContextMenu(null)}
        >
          <button
            onClick={() => deleteChat(contextMenu.chatId)}
            className="px-4 py-3 text-red-400 hover:bg-red-500/20 transition-all text-sm w-full text-left rounded-t-xl"
          >
            Delete Chat
          </button>
        </div>
      )}

      {/* Click outside to close context menu */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
