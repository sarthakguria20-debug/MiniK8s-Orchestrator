import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Box, Trash2, Zap, MonitorPlay, Server } from 'lucide-react';
import { cn } from './Terminal';

interface Deployment {
    name: string;
    image: string;
    replicas: number;
}

interface Container {
    id: string;
    image: string;
    state: 'running' | 'exited' | 'pulling';
    labels: Record<string, string>;
    createdAt: number;
}

interface EventLog {
    time: number;
    message: string;
}

interface VisualizerProps {
    deployments: Deployment[];
    containers: Container[];
    events: EventLog[];
    onCrashContainer: (id: string) => void;
    onDeleteDeployment: (name: string) => void;
}

export function Visualizer({ deployments, containers, events, onCrashContainer, onDeleteDeployment }: VisualizerProps) {
    return (
        <div className="flex flex-col h-full bg-white/5 backdrop-blur-xl rounded-3xl overflow-hidden border border-white/10 relative shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-cyan-400" />
                    Cluster State
                </h2>
                <div className="flex gap-4 text-sm font-medium text-slate-400">
                    <div className="flex items-center gap-1">
                        <Box className="w-4 h-4" /> {deployments.length} Deployments
                    </div>
                    <div className="flex items-center gap-1">
                        <Server className="w-4 h-4" /> {containers.length} Containers
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {deployments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-slate-500">
                        <MonitorPlay className="w-12 h-12 mb-4 opacity-50" />
                        <p>No deployments active. Use the terminal to apply one.</p>
                        <code className="mt-2 text-xs bg-white/5 border border-white/10 px-2 py-1 rounded text-cyan-400 font-mono">apply app nginx:latest 3</code>
                    </div>
                ) : null}

                {deployments.map(dep => {
                    const matchedContainers = containers.filter(c => c.labels['deployment'] === dep.name);
                    const runningCount = matchedContainers.filter(c => c.state === 'running').length;
                    const isHealthy = runningCount === dep.replicas;

                    return (
                        <div key={dep.name} className="flex flex-col rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-white/5">
                                <div>
                                    <h3 className="text-base font-semibold text-white flex items-center gap-2">
                                        {dep.name}
                                        <span className={cn("px-2 py-0.5 rounded-full border text-[10px] uppercase font-mono tracking-wider", 
                                            isHealthy ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                                        )}>
                                            {runningCount} / {dep.replicas} Replicas
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1 font-mono">Image: {dep.image}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => onDeleteDeployment(dep.name)}
                                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
                                        title="Delete Deployment"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                <AnimatePresence mode="popLayout">
                                    {matchedContainers.length === 0 && (
                                        <motion.div 
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            className="col-span-full py-4 text-center text-sm text-slate-500 italic"
                                        >
                                            Scaling up...
                                        </motion.div>
                                    )}
                                    {matchedContainers.map(container => (
                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                                            key={container.id}
                                            className={cn(
                                                "relative p-4 rounded-xl border flex flex-col gap-3 group transition-colors shadow-sm",
                                                container.state === 'running' ? "bg-white/5 border-white/10" : "bg-red-500/5 border-red-500/20"
                                            )}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="relative flex h-2.5 w-2.5">
                                                        {container.state === 'running' && (
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                        )}
                                                        <span className={cn("relative inline-flex rounded-full h-2.5 w-2.5 shadow-[0_0_8px_rgba(34,197,94,0.4)]", 
                                                            container.state === 'running' ? "bg-green-500" : "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]"
                                                        )}></span>
                                                    </span>
                                                    <span className="font-mono text-xs text-slate-300">
                                                        {container.id}
                                                    </span>
                                                </div>
                                                <span className={cn("text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded border border-transparent",
                                                    container.state === 'running' ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                                                )}>
                                                    {container.state}
                                                </span>
                                            </div>

                                            {container.state === 'running' ? (
                                                <button
                                                    onClick={() => onCrashContainer(container.id)}
                                                    className="w-full flex items-center justify-center gap-1 py-1.5 text-xs font-mono text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded border border-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Zap className="w-3.5 h-3.5" /> Crash Pod
                                                </button>
                                            ) : (
                                                <div className="w-full py-1.5 text-[10px] tracking-widest uppercase font-mono text-center text-orange-400 bg-orange-500/10 rounded border border-orange-500/20">
                                                    Terminated
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="h-48 border-t border-white/5 bg-[#0a0f1d] text-slate-300 font-mono text-[11px] overflow-hidden flex flex-col shrink-0">
                <div className="px-4 py-2 border-b border-white/5 text-slate-500 uppercase tracking-widest font-semibold text-[10px] bg-[#0a0f1d]">
                    Orchestrator Events
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-1">
                    {events.map((event, i) => (
                        <div key={i} className="flex gap-3 text-slate-400 opacity-90">
                            <span className="shrink-0 text-cyan-400 opacity-75">
                                {new Date(event.time).toISOString().substring(11, 23)}
                            </span>
                            <span className={cn(
                                event.message.includes('Error') || event.message.includes('Crash') ? "text-orange-400" :
                                event.message.includes('Started') || event.message.includes('applied') ? "text-green-400" : "text-slate-300"
                            )}>
                                {event.message}
                            </span>
                        </div>
                    ))}
                    {events.length === 0 && <div className="text-slate-600 italic">No events yet...</div>}
                </div>
            </div>
        </div>
    );
}
