export type ContainerState = 'running' | 'exited' | 'pulling';

export interface Container {
    id: string;
    image: string;
    state: ContainerState;
    labels: Record<string, string>;
    createdAt: number;
}

class MockDockerClient {
    containers: Container[] = [];
    images: Set<string> = new Set(['nginx:latest', 'redis:latest']);
    
    getContainers() {
        return this.containers;
    }
    
    async pullImage(image: string, eventCb: (msg: string) => void) {
        if (this.images.has(image)) return;
        eventCb(`Pulling image ${image}...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        this.images.add(image);
        eventCb(`Successfully pulled ${image}`);
    }
    
    startContainer(image: string, labels: Record<string, string>) {
        if (!this.images.has(image)) {
            throw new Error(`Image ${image} not pulled`);
        }
        const id = Math.random().toString(36).substring(2, 10);
        this.containers.push({
            id,
            image,
            state: 'running',
            labels,
            createdAt: Date.now()
        });
        return id;
    }
    
    stopContainer(id: string) {
        const c = this.containers.find(x => x.id === id);
        if (c) {
            c.state = 'exited';
            // Simulating real docker handling where 'docker rm' removes it
            // For orchestrator, the orchestrator handles removing it from view when dead.
            // Actually, we'll physically remove to prevent memory leak here
            setTimeout(() => {
                this.containers = this.containers.filter(x => x.id !== id);
            }, 500); 
        }
    }
    
    crashContainer(id: string) {
        const c = this.containers.find(x => x.id === id);
        if (c) {
            c.state = 'exited';
        }
    }
}

export interface Deployment {
    name: string;
    image: string;
    replicas: number;
}

export interface EventLog {
    time: number;
    message: string;
}

export class Orchestrator {
    docker = new MockDockerClient();
    deployments = new Map<string, Deployment>();
    events: EventLog[] = [];
    private interval: any;
    
    log(message: string) {
        this.events.unshift({ time: Date.now(), message });
        if (this.events.length > 100) this.events.pop();
        console.log(`[Orchestrator] ${message}`);
    }
    
    getEvents() {
        return this.events;
    }
    
    getDeployments() {
        return Array.from(this.deployments.values());
    }
    
    applyDeployment(name: string, image: string, replicas: number) {
        this.deployments.set(name, { name, image, replicas });
        this.log(`Deployment applied: ${name} (Image: ${image}, Replicas: ${replicas})`);
    }

    deleteDeployment(name: string) {
       this.deployments.delete(name);
       this.log(`Deployment deleted: ${name}`);
    }
    
    start() {
        if (!this.interval) {
            this.interval = setInterval(() => this.reconcile(), 2000);
            this.log('Orchestrator loop started.');
        }
    }
    
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            this.log('Orchestrator loop stopped.');
        }
    }
    
    async reconcile() {
        const actualContainers = this.docker.getContainers();
        
        // 1. Clean up containers that don't belong to any deployment or are exited
        for (const c of actualContainers) {
            const depName = c.labels['deployment'];
            const dep = this.deployments.get(depName);
            
            if (c.state === 'exited') {
                this.log(`Found crashed/exited container ${c.id} for "${depName}". Removing...`);
                this.docker.stopContainer(c.id);
            } else if (!dep) {
                // Deployment was deleted or scaled down
                // Note: Scaling down is handled differently below, here we just check if deployment is gone
                this.log(`Container ${c.id} belongs to unknown/deleted deployment "${depName}". Terminating...`);
                this.docker.stopContainer(c.id);
            }
        }
        
        // 2. Enforce replicas for each deployment
        for (const [name, dep] of this.deployments.entries()) {
            const runningForDep = this.docker.getContainers().filter(
                c => c.labels['deployment'] === name && c.state === 'running'
            );
            
            if (runningForDep.length < dep.replicas) {
                const diff = dep.replicas - runningForDep.length;
                this.log(`Deployment "${name}" under-replicated (${runningForDep.length}/${dep.replicas}). Starting ${diff} instances.`);
                
                try {
                    await this.docker.pullImage(dep.image, (msg) => this.log(msg));
                    for (let i = 0; i < diff; i++) {
                        const id = this.docker.startContainer(dep.image, { deployment: name });
                        this.log(`Started container ${id} for deployment "${name}"`);
                    }
                } catch (e: any) {
                    this.log(`Error scaling "${name}": ${e.message}`);
                }
            } else if (runningForDep.length > dep.replicas) {
                const diff = runningForDep.length - dep.replicas;
                this.log(`Deployment "${name}" over-replicated (${runningForDep.length}/${dep.replicas}). Stopping ${diff} instances.`);
                for (let i = 0; i < diff; i++) {
                    const c = runningForDep[i];
                    this.docker.stopContainer(c.id);
                    this.log(`Stopped container ${c.id} for scale down of "${name}"`);
                }
            }
        }
    }
}
