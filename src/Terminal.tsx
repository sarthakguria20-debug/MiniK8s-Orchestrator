import React, { useState, useRef, useEffect } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TerminalProps {
    onCommand: (cmd: string) => Promise<string | void>;
    logs: string[];
}

export function Terminal({ onCommand, logs }: TerminalProps) {
    const [input, setInput] = useState('');
    const [history, setHistory] = useState<{ type: 'input' | 'output'; text: string }[]>([]);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Initial greeting
    useEffect(() => {
        setHistory([
            { type: 'output', text: 'Mini-K8s CLI v1.0.0' },
            { type: 'output', text: 'Type "help" for a list of commands.' }
        ]);
    }, []);

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [history]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimCmd = input.trim();
        if (!trimCmd) return;
        
        let newHistory = [...history, { type: 'input' as const, text: trimCmd }];
        setHistory(newHistory);
        setInput('');

        if (trimCmd.toLowerCase() === 'clear') {
            setHistory([]);
            return;
        }

        try {
            const output = await onCommand(trimCmd);
            if (output) {
                setHistory(prev => [...prev, { type: 'output', text: output }]);
            }
        } catch (err: any) {
            setHistory(prev => [...prev, { type: 'output', text: `Error: ${err.message || err}` }]);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0f1d] border border-white/10 rounded-3xl text-sm font-mono overflow-hidden shadow-xl">
            <div className="flex justify-between items-center px-4 py-3 border-b border-white/5 bg-white/5 shrink-0">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold flex items-center gap-2">
                    Interactive CLI
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-1 opacity-90">
                {history.map((line, i) => (
                    <div key={i} className="flex">
                        {line.type === 'input' ? (
                            <>
                                <span className="text-cyan-400 mr-2">➜</span>
                                <span className="text-blue-400 mr-2">~</span>
                                <span className="text-slate-200">{line.text}</span>
                            </>
                        ) : (
                            <span className="text-slate-400 whitespace-pre-wrap">{line.text}</span>
                        )}
                    </div>
                ))}
                
                <form onSubmit={handleSubmit} className="flex mt-2">
                    <span className="text-cyan-400 mr-2">➜</span>
                    <span className="text-blue-400 mr-2">~</span>
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        className="flex-1 bg-transparent outline-none border-none focus:ring-0 p-0 text-slate-200"
                        autoFocus
                    />
                </form>
                <div ref={bottomRef} />
            </div>
        </div>
    );
}
