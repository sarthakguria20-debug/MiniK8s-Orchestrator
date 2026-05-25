/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Terminal } from './Terminal';
import { Visualizer } from './Visualizer';

export default function App() {
  const [deployments, setDeployments] = useState([]);
  const [containers, setContainers] = useState([]);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch('/api/state');
        if (res.ok) {
          const data = await res.json();
          setDeployments(data.deployments || []);
          setContainers(data.containers || []);
          setEvents(data.events || []);
        }
      } catch (e) {
        console.error('Failed to fetch state');
      }
    };
    
    fetchState();
    const interval = setInterval(fetchState, 500);
    return () => clearInterval(interval);
  }, []);

  const handleCommand = async (cmd: string): Promise<string | void> => {
    const parts = cmd.trim().split(/\s+/);
    if (!parts.length) return;

    const op = parts[0].toLowerCase();

    if (op === 'apply') {
      if (parts.length < 4) return 'Usage: apply <name> <image> <replicas>';
      const name = parts[1];
      const image = parts[2];
      const replicas = parseInt(parts[3], 10);
      if (isNaN(replicas)) return 'Error: replicas must be a number';

      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, image, replicas })
      });
      if (res.ok) return `Deployment '${name}' applied with ${replicas} replicas.`;
      return `Error applying deployment`;
    }

    if (op === 'delete') {
      if (parts.length < 2) return 'Usage: delete <name>';
      const name = parts[1];
      const res = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (res.ok) return `Deployment '${name}' deleted.`;
      return `Error deleting deployment`;
    }

    if (op === 'get') {
      const resource = parts[1]?.toLowerCase();
      if (resource === 'deploy' || resource === 'deployments') {
         return deployments.length ? 
           `NAME\tIMAGE\tREPLICAS\n` + deployments.map(d => `${d.name}\t${d.image}\t${d.replicas}`).join('\n') 
           : 'No resources found in default namespace.';
      }
      if (resource === 'pods' || resource === 'containers') {
        return containers.length ?
          `ID\t\tDEPLOYMENT\tSTATE\n` + containers.map(c => `${c.id}\t${c.labels['deployment'] || '-'}\t${c.state.toUpperCase()}`).join('\n')
          : 'No resources found in default namespace.';
      }
      return 'Usage: get [deploy|pods]';
    }
    
    if (op === 'crash') {
      if (parts.length < 2) return 'Usage: crash <id>';
      const id = parts[1];
      return handleCrashContainer(id);
    }
    
    if (op === 'help') {
      return `Available Commands:
  apply <name> <image> <replicas>  Create or update a deployment
  delete <name>                    Delete a deployment
  get deploy                       List deployments
  get pods                         List running containers
  crash <pod-id>                   Force crash a container to test orchestrator limits
  clear                            Clear terminal`;
    }

    return `Command not found: ${op}. Type "help" for a list of commands.`;
  };

  const handleCrashContainer = async (id: string) => {
    const res = await fetch('/api/crash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (res.ok) return `Pod ${id} crashed. Orchestrator should restart it automatically.`;
    return `Error crashing pod`;
  };

  const handleDeleteDeployment = async (name: string) => {
    await fetch('/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col p-4 md:p-6 font-sans relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/30 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[100px]"></div>
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-indigo-900/20 rounded-full blur-[80px]"></div>
      </div>
      
      <header className="relative z-10 flex gap-4 md:items-center flex-col md:flex-row justify-between mb-6 bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl">
         <div className="flex items-center space-x-3">
             <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/20">
                 <span className="text-white font-bold text-xl">μ</span>
             </div>
             <div>
                 <h1 className="text-lg font-bold tracking-tight text-white">MiniK8s Orchestrator</h1>
                 <p className="text-[10px] text-cyan-400 font-mono tracking-widest uppercase mb-0">Simulated control loop matching desired state vs actual state</p>
             </div>
         </div>
      </header>
      
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_400px] gap-6 overflow-hidden min-h-0">
         <div className="h-full overflow-hidden flex flex-col">
             <Visualizer 
                deployments={deployments} 
                containers={containers} 
                events={events} 
                onCrashContainer={handleCrashContainer}
                onDeleteDeployment={handleDeleteDeployment}
             />
         </div>
         <div className="h-full flex flex-col overflow-hidden">
             <Terminal onCommand={handleCommand} logs={[]} />
         </div>
      </div>
    </div>
  );
}
