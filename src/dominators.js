// Lengauer-Tarjan dominators for a directed graph rooted at node zero.
// CSR arrays contain only edges selected by the caller's retention model.
export function dominators(offsets, targets, sizes) {
  const count=sizes.length;
  const dfs=new Int32Array(count), vertex=new Int32Array(count+1), parent=new Int32Array(count+1);
  let n=1;dfs[0]=1;vertex[1]=0;
  const stack=[0], cursor=[offsets[0]];
  while(stack.length) {
    const top=stack.length-1,v=stack[top];
    if(cursor[top]>=offsets[v+1]) {stack.pop();cursor.pop();continue;}
    const w=targets[cursor[top]++];
    if(!dfs[w]) {dfs[w]=++n;vertex[n]=w;parent[n]=dfs[v];stack.push(w);cursor.push(offsets[w]);}
  }
  const predOffsets=new Uint32Array(count+1);
  for(let v=0;v<count;v++) if(dfs[v]) for(let e=offsets[v];e<offsets[v+1];e++) if(dfs[targets[e]]) predOffsets[targets[e]+1]++;
  for(let i=1;i<=count;i++) predOffsets[i]+=predOffsets[i-1];
  const preds=new Uint32Array(predOffsets[count]), at=predOffsets.slice();
  for(let v=0;v<count;v++) if(dfs[v]) for(let e=offsets[v];e<offsets[v+1];e++) if(dfs[targets[e]]) preds[at[targets[e]]++]=dfs[v];
  const semi=new Int32Array(n+1),label=new Int32Array(n+1),ancestor=new Int32Array(n+1),idomDfs=new Int32Array(n+1);
  const bucketHead=new Int32Array(n+1),bucketNext=new Int32Array(n+1);
  for(let i=1;i<=n;i++) semi[i]=label[i]=i;
  const path=[];
  function evaluate(v) {
    if(!ancestor[v]) return label[v];
    path.length=0;let x=v;
    while(ancestor[ancestor[x]]) {path.push(x);x=ancestor[x];}
    for(let i=path.length-1;i>=0;i--) {x=path[i];const a=ancestor[x];if(semi[label[a]]<semi[label[x]])label[x]=label[a];ancestor[x]=ancestor[a];}
    return label[v];
  }
  for(let w=n;w>=2;w--) {
    const node=vertex[w];
    for(let e=predOffsets[node];e<predOffsets[node+1];e++) semi[w]=Math.min(semi[w],semi[evaluate(preds[e])]);
    bucketNext[w]=bucketHead[semi[w]];bucketHead[semi[w]]=w;
    const p=parent[w];ancestor[w]=p;
    for(let v=bucketHead[p];v;v=bucketNext[v]) {const u=evaluate(v);idomDfs[v]=semi[u]<semi[v]?u:p;}
    bucketHead[p]=0;
  }
  for(let w=2;w<=n;w++) if(idomDfs[w]!==semi[w]) idomDfs[w]=idomDfs[idomDfs[w]];
  const idom=new Int32Array(count).fill(-1), retained=new Float64Array(count);
  for(let i=1;i<=n;i++) retained[vertex[i]]=sizes[vertex[i]];
  for(let w=n;w>=2;w--) {const node=vertex[w],p=vertex[idomDfs[w]];idom[node]=p;retained[p]+=retained[node];}
  return {idom,retained,reachable:n};
}

// Constructor union: exclude a node if an ancestor has the same label.
// Different labels can overlap and must never be added together.
export function retainedByLabel(idom, retained, sizes, labels) {
  const count=idom.length,head=new Int32Array(count).fill(-1),next=new Int32Array(count).fill(-1);
  for(let i=1;i<count;i++) if(idom[i]>=0) {next[i]=head[idom[i]];head[idom[i]]=i;}
  const rows=new Map(),depth=new Map(),stack=[0];
  while(stack.length) {
    const token=stack.pop();
    if(token<0) {const label=labels[~token];if(label)depth.set(label,depth.get(label)-1);continue;}
    const label=labels[token];
    if(label) {
      let row=rows.get(label);if(!row)rows.set(label,row={label,count:0,shallowBytes:0,unionRetainedBytes:0,maxRetainedBytes:0});
      row.count++;row.shallowBytes+=sizes[token];row.maxRetainedBytes=Math.max(row.maxRetainedBytes,retained[token]);
      if(!depth.get(label))row.unionRetainedBytes+=retained[token];
      depth.set(label,(depth.get(label)??0)+1);
    }
    stack.push(~token);
    for(let child=head[token];child>=0;child=next[child])stack.push(child);
  }
  return [...rows.values()].sort((a,b)=>b.unionRetainedBytes-a.unionRetainedBytes);
}
