
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
import { Difficulty, Scenario, InternalState, InterviewPhase, Message, FinalReport } from './types';
import { generateScenario, SYSTEM_INSTRUCTION_BASE, generateFeedback } from './services/geminiService';

const App: React.FC = () => {
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatSession, setChatSession] = useState<any>(null);
  const [finalReport, setFinalReport] = useState<FinalReport | null>(null);
  const [latestState, setLatestState] = useState<InternalState | null>(null);
  const [currentPhase, setCurrentPhase] = useState<InterviewPhase>(InterviewPhase.RAPPORT);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const startSimulation = async (diff: Difficulty) => {
    setIsGenerating(true);
    setDifficulty(diff);
    try {
      const newScenario = await generateScenario(diff);
      setScenario(newScenario);

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      const systemPrompt = `
        ${SYSTEM_INSTRUCTION_BASE}
        
        SCENARIO CONTEXT:
        Type: ${newScenario.investigationType}
        Company: ${newScenario.companyBackground}
        Jurisdiction: ${newScenario.jurisdiction}
        Exposure: ${newScenario.regulatoryExposure}
        Witness Role: ${newScenario.witnessRole}
        Witness Archetype: ${newScenario.witnessArchetype}
        Ground Truth (HIDDEN FROM USER): ${(newScenario as any).hiddenGroundTruth}
        Risk Nodes: ${(newScenario as any).keyRiskNodes?.join(', ')}
        
        DIFFICULTY LEVEL: ${diff}
        
        INITIAL STATE:
        Truthfulness: 70, Stress: 10, Defensiveness: 20, Cooperation: 80, Memory: 90, Exposure: 5, Legal Risk: 0.
      `;

      const chat = ai.chats.create({
        model: 'gemini-3-pro-preview',
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json"
        }
      });
      setChatSession(chat);
      
      setMessages([{
        role: 'model',
        text: newScenario.witnessIntroduction
      }]);
    } catch (error) {
      console.error("Error starting simulation:", error);
      alert("Failed to initialize simulation. Please check your connection.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !chatSession || isGenerating) return;

    const userText = inputValue;
    if (userText.toLowerCase() === 'end interview') {
      endInterview();
      return;
    }

    setInputValue('');
    const newMessages: Message[] = [...messages, { role: 'user', text: userText }];
    setMessages(newMessages);
    setIsGenerating(true);

    try {
      const response = await chatSession.sendMessage({ message: userText });
      const data = JSON.parse(response.text);
      
      setLatestState(data.updatedState);
      setCurrentPhase(data.currentPhase as InterviewPhase);
      
      setMessages([...newMessages, { 
        role: 'model', 
        text: data.witnessResponse,
        phase: data.currentPhase,
        hiddenState: data.updatedState
      }]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages([...newMessages, { role: 'model', text: "I'm sorry, I'm having trouble processing that question." }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const endInterview = async () => {
    setIsGenerating(true);
    try {
      const report = await generateFeedback(messages, scenario!);
      setFinalReport(report);
    } catch (error) {
      console.error("Error generating report:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (finalReport) {
    return <FinalReportView report={finalReport} onReset={() => window.location.reload()} />;
  }

  if (!difficulty) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950">
        <div className="max-w-2xl w-full space-y-8 text-center">
          <div className="space-y-2">
            <h1 className="text-5xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">
              DeepWitness
            </h1>
            <p className="text-slate-400 text-lg">Full-System Witness Interview Simulation Engine</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.values(Difficulty).map((diff) => (
              <button
                key={diff}
                onClick={() => startSimulation(diff)}
                disabled={isGenerating}
                className="group relative p-6 bg-slate-900 border border-slate-800 hover:border-indigo-500 rounded-xl transition-all duration-300 text-left hover:shadow-[0_0_20px_rgba(79,70,229,0.1)]"
              >
                <h3 className="text-xl font-semibold text-white mb-1 group-hover:text-indigo-400 transition-colors">{diff}</h3>
                <p className="text-slate-500 text-sm">
                  {diff === Difficulty.BEGINNER && "Focused guidance and clearer factual patterns."}
                  {diff === Difficulty.INTERMEDIATE && "Mixed motives and subtle contradictions."}
                  {diff === Difficulty.ADVANCED && "Coached witness with complex legal exposures."}
                  {diff === Difficulty.CRISIS && "Extreme emotional volatility and high regulatory risk."}
                </p>
                {isGenerating && <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center rounded-xl">
                  <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent animate-spin rounded-full"></div>
                </div>}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950">
      {/* Sidebar - Scenario Info */}
      <div className="w-80 border-r border-slate-800 flex flex-col hidden lg:flex">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">Live Simulation</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2 text-indigo-100">DeepWitness</h2>
          <div className="mb-4">
            <span className="text-sm font-semibold text-slate-400 block mb-1">Investigation</span>
            <p className="text-base text-slate-200 leading-tight">{scenario?.investigationType}</p>
          </div>
          <span className="px-2 py-1 bg-indigo-900/40 text-indigo-300 text-[10px] font-bold uppercase rounded border border-indigo-700">
            {difficulty}
          </span>
        </div>
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-sm">
          <div>
            <h4 className="text-slate-500 font-bold uppercase tracking-wider mb-2 text-xs">Background</h4>
            <p className="text-slate-300 leading-relaxed">{scenario?.companyBackground}</p>
          </div>
          <div>
            <h4 className="text-slate-500 font-bold uppercase tracking-wider mb-2 text-xs">Jurisdiction</h4>
            <p className="text-slate-300">{scenario?.jurisdiction}</p>
          </div>
          <div>
            <h4 className="text-slate-500 font-bold uppercase tracking-wider mb-2 text-xs">Exposure Level</h4>
            <span className={`font-semibold ${
              scenario?.regulatoryExposure === 'High' ? 'text-red-400' : 
              scenario?.regulatoryExposure === 'Medium' ? 'text-yellow-400' : 'text-green-400'
            }`}>
              {scenario?.regulatoryExposure}
            </span>
          </div>
          <div>
            <h4 className="text-slate-500 font-bold uppercase tracking-wider mb-2 text-xs">Witness Role</h4>
            <p className="text-slate-300">{scenario?.witnessRole}</p>
          </div>
          <div>
            <h4 className="text-slate-500 font-bold uppercase tracking-wider mb-2 text-xs">Document Summary</h4>
            <p className="text-slate-300 leading-relaxed italic">"{scenario?.documentUniverse}"</p>
          </div>
        </div>
        <div className="p-4 border-t border-slate-800 text-[10px] text-slate-600 font-mono">
          DEEPWITNESS CORE V1.0 // LAYER 7 ACTIVE
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-tighter">Current Phase</span>
              <span className="text-sm font-semibold text-slate-200">{currentPhase}</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={endInterview}
              className="text-xs font-bold text-red-400 hover:text-red-300 px-3 py-1.5 border border-red-900/50 hover:bg-red-900/20 rounded-md transition-all uppercase tracking-widest"
            >
              End Interview
            </button>
          </div>
        </div>

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth"
        >
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${
                m.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-none px-4 py-3' 
                  : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-2xl rounded-tl-none px-4 py-3 shadow-xl'
              }`}>
                {m.role === 'model' && (
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800">
                    <div className="w-2 h-2 rounded-full bg-slate-700"></div>
                    <span className="text-[10px] font-bold uppercase text-slate-500">Witness Response</span>
                  </div>
                )}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</p>
              </div>
            </div>
          ))}
          {isGenerating && (
            <div className="flex justify-start">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none px-6 py-4">
                <div className="flex gap-1.5">
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-75"></div>
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-150"></div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-950/80 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto flex gap-4">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask a question..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-200"
            />
            <button
              onClick={handleSendMessage}
              disabled={isGenerating}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
            >
              Send
            </button>
          </div>
          <p className="mt-3 text-center text-[10px] text-slate-600 uppercase tracking-[0.2em]">Type "End Interview" to terminate and generate final report</p>
        </div>
      </div>
    </div>
  );
};

const FinalReportView: React.FC<{ report: FinalReport, onReset: () => void }> = ({ report, onReset }) => {
  return (
    <div className="min-h-screen bg-slate-950 p-8 flex justify-center overflow-y-auto">
      <div className="max-w-4xl w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">DeepWitness Analysis</h1>
            <p className="text-slate-400 uppercase tracking-widest text-xs font-semibold">Evaluation Report // Confidential</p>
          </div>
          <button 
            onClick={onReset}
            className="px-4 py-2 border border-slate-700 text-slate-300 hover:bg-slate-800 rounded-lg text-sm transition-colors"
          >
            Start New Session
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard label="Timeline Reconstruction" score={report.timelineReconstructionScore} />
          <MetricCard label="Contradiction Identification" score={report.contradictionIdentificationScore} />
          <MetricCard label="Risk Escalation Awareness" score={report.riskEscalationAwareness} />
          <MetricCard label="Interview Control" score={report.interviewControlAssessment} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Behavioral Analysis of Witness</h3>
            <p className="text-slate-300 text-sm leading-relaxed">{report.behavioralAnalysis}</p>
          </div>
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Legal Exposure Analysis</h3>
            <p className="text-slate-300 text-sm leading-relaxed">{report.legalExposureAnalysis}</p>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Missed Risk Flags / Follow-Ups</h3>
          <ul className="space-y-3">
            {report.missedFollowUps.map((item, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-400">
                <span className="text-indigo-500 font-bold">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-indigo-900/20 p-6 rounded-2xl border border-indigo-500/30 shadow-xl">
          <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-4">Recommended Questioning Paths</h3>
          <ul className="space-y-4">
            {report.improvedQuestioningPaths.map((item, i) => (
              <li key={i} className="text-sm text-indigo-200 italic">
                "{item}"
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ label: string, score: number }> = ({ label, score }) => (
  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</div>
    <div className="flex items-end gap-2">
      <div className="text-3xl font-bold text-white leading-none">{score}</div>
      <div className="text-xs text-slate-600 mb-1">/100</div>
    </div>
    <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
      <div 
        className={`h-full rounded-full transition-all duration-1000 ${
          score > 75 ? 'bg-green-500' : score > 50 ? 'bg-yellow-500' : 'bg-red-500'
        }`}
        style={{ width: `${score}%` }}
      />
    </div>
  </div>
);

export default App;
