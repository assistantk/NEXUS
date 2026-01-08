import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, X, Shield, Activity, TrendingUp, AlertTriangle, ArrowRight, HelpCircle } from 'lucide-react';
import { Stock, ChatMessage, PredictionResult, Candle } from '../../types';
import { getGeminiChatResponse, generateAIPrediction } from '../../services/geminiService';

interface IntegratedAIProps {
  stock: Stock;
  history: Candle[];
  isOpen: boolean;
  onClose: () => void;
  onPredictionUpdate: (prediction: PredictionResult | null) => void;
  currentPrediction: PredictionResult | null;
}

const IntegratedAI: React.FC<IntegratedAIProps> = ({ 
  stock, 
  history, 
  isOpen, 
  onClose,
  onPredictionUpdate,
  currentPrediction
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize with greeting or context
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'init',
          role: 'model',
          text: `I'm tracking ${stock.symbol} real-time. Would you like to generate a price forecast or analyze the current trend?`,
          timestamp: new Date()
        }
      ]);
    }
  }, [isOpen, stock.symbol]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleRunForecast = async () => {
    setIsTyping(true);
    const loadingMsg: ChatMessage = {
      id: 'loading-pred',
      role: 'model',
      text: "Analyzing market structure and volatility patterns...",
      timestamp: new Date()
    };
    setMessages(prev => [...prev, loadingMsg]);

    try {
      // Filter out existing predictions for clean analysis
      const cleanHistory = history.filter(c => !c.isPrediction);
      const prediction = await generateAIPrediction(stock.symbol, cleanHistory);
      
      onPredictionUpdate(prediction);
      
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== 'loading-pred');
        return [
          ...filtered, 
          {
            id: Date.now().toString(),
            role: 'model',
            text: prediction?.reasoning || "Analysis complete. I've projected the trend and highlighted the forecast period on the chart.",
            timestamp: new Date()
          }
        ];
      });

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev.filter(m => m.id !== 'loading-pred'), {
        id: Date.now().toString(),
        role: 'model',
        text: "I encountered an error processing the market data.",
        timestamp: new Date()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const processUserMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      // Create context string from prediction if available
      let context = "";
      if (currentPrediction) {
        context = `[SYSTEM DATA: ACTIVE PREDICTION]
        Trend: ${currentPrediction.trend}
        Confidence: ${currentPrediction.confidence}%
        Risk: ${currentPrediction.riskLevel}
        Reasoning: ${currentPrediction.reasoning}
        Target Price: $${currentPrediction.targetPrice}
        
        [INSTRUCTION]
        The user is asking for clarification on this specific prediction.
        Explain the trend, confidence, and risk level in simple terms.
        - Explain ${currentPrediction.confidence}% confidence (e.g., how reliable is this?).
        - Explain ${currentPrediction.riskLevel} risk (what is the downside?).
        - Explain the driver "${currentPrediction.reasoning}" in plain English.
        - Keep it beginner-friendly and avoid complex jargon.`;
      } else {
        context = `[SYSTEM DATA] No active AI prediction is currently generated/displayed on the chart. If the user asks for a forecast, suggest they use the "Generate AI Forecast" button.`;
      }

      const response = await getGeminiChatResponse(text, stock, context);
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: response,
        timestamp: new Date()
      }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "I was unable to process your request at this time.",
        timestamp: new Date()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const textToSend = input;
    setInput('');
    await processUserMessage(textToSend);
  };

  const handleExplainPrediction = () => {
    processUserMessage("Can you explain the confidence and risk of this prediction in simple terms?");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-4 right-4 bottom-4 w-80 md:w-96 flex flex-col bg-surface/95 dark:bg-[#0B0E14]/90 backdrop-blur-xl border border-white/20 dark:border-slate-700/50 rounded-2xl shadow-2xl z-20 overflow-hidden animate-in slide-in-from-right-10 duration-300">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-white/50 dark:bg-white/5">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <Sparkles className="text-white w-4 h-4" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Nova Analyst</h3>
                    <p className="text-[10px] text-slate-500 font-medium">Live Market Context</p>
                </div>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors text-slate-500">
                <X size={18} />
            </button>
        </div>

        {/* Prediction Stats HUD (Only shows if prediction exists) */}
        {currentPrediction && (
             <div className="bg-indigo-900/10 dark:bg-indigo-900/20 border-b border-indigo-500/10 p-4 grid grid-cols-3 gap-2">
                 <div className="flex flex-col items-center p-2 bg-surface/50 dark:bg-black/20 rounded-lg border border-border/50">
                     <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">Trend</span>
                     <div className={`flex items-center gap-1 mt-1 font-bold text-xs ${currentPrediction.trend === 'UP' ? 'text-emerald-500' : currentPrediction.trend === 'DOWN' ? 'text-rose-500' : 'text-amber-500'}`}>
                         {currentPrediction.trend === 'UP' ? <TrendingUp size={12} /> : <Activity size={12} />}
                         {currentPrediction.trend}
                     </div>
                 </div>
                 <div className="flex flex-col items-center p-2 bg-surface/50 dark:bg-black/20 rounded-lg border border-border/50">
                     <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">Conf.</span>
                     <div className="flex items-center gap-1 mt-1 font-bold text-xs text-indigo-500">
                         <Shield size={12} />
                         {currentPrediction.confidence}%
                     </div>
                 </div>
                 <div className="flex flex-col items-center p-2 bg-surface/50 dark:bg-black/20 rounded-lg border border-border/50">
                     <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">Risk</span>
                     <div className={`flex items-center gap-1 mt-1 font-bold text-xs ${currentPrediction.riskLevel === 'HIGH' ? 'text-rose-500' : currentPrediction.riskLevel === 'MEDIUM' ? 'text-amber-500' : 'text-emerald-500'}`}>
                         <AlertTriangle size={12} />
                         {currentPrediction.riskLevel}
                     </div>
                 </div>
             </div>
        )}

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                        msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-br-none' 
                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-bl-none'
                    }`}>
                        {msg.text}
                    </div>
                </div>
            ))}
            
            {/* Typing Indicator */}
            {isTyping && (
                <div className="flex justify-start">
                     <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-2xl rounded-bl-none flex gap-1.5 items-center">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce delay-75"></span>
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce delay-150"></span>
                     </div>
                </div>
            )}
            
            {/* Quick Actions */}
            {!isTyping && (
                <div className="flex flex-col gap-2">
                    {!currentPrediction && messages.length < 3 && (
                        <button 
                            onClick={handleRunForecast}
                            className="w-full py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 group"
                        >
                            <Sparkles size={14} className="group-hover:scale-110 transition-transform" /> Generate AI Forecast
                        </button>
                    )}
                    
                    {currentPrediction && (
                         <button 
                            onClick={handleExplainPrediction}
                            className="w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 group animate-in fade-in"
                        >
                            <HelpCircle size={14} className="group-hover:scale-110 transition-transform" /> Explain Confidence & Risk
                        </button>
                    )}
                </div>
            )}
            
            <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 border-t border-border bg-white/50 dark:bg-white/5">
            <div className="relative flex items-center gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about this chart..."
                    className="flex-1 bg-transparent border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors text-slate-900 dark:text-white placeholder:text-slate-500"
                />
                <button 
                    onClick={handleSend}
                    disabled={!input.trim() || isTyping}
                    className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 transition-all"
                >
                    <Send size={16} />
                </button>
            </div>
            <p className="text-[9px] text-center text-slate-400 mt-2">
                Predictions are AI-generated estimates, not financial advice.
            </p>
        </div>
    </div>
  );
};

export default IntegratedAI;