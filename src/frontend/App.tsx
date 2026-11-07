import React, { useState, useEffect } from "react";
import { Code2, Plus, Globe, Eye, Share2, ChevronRight, X, Save } from "lucide-react";

export default function App() {
  const [view, setView] = useState("gallery");
  const [showNewModal, setShowNewModal] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <nav className="border-b bg-white px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-indigo-600 cursor-pointer" onClick={() => setView("gallery")}>
          <div className="bg-indigo-600 text-white p-1 rounded-md">
            <Code2 size={24} />
          </div>
          CodeHost
        </div>
        <div className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <button onClick={() => setView("gallery")} className={`transition-colors ${view === "gallery" ? "text-indigo-600" : "hover:text-indigo-400"}`}>Gallery</button>
          <button onClick={() => setView("dashboard")} className={`transition-colors ${view === "dashboard" ? "text-indigo-600" : "hover:text-indigo-400"}`}>Dashboard</button>
          <div className="h-4 w-[1px] bg-slate-200" />
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-all shadow-sm hover:shadow-indigo-500/20 active:scale-95">Sign In</button>
        </div>
      </nav>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        {view === "gallery" ? <GalleryView /> : <DashboardView onCreate={() => setShowNewModal(true)} />}
      </main>

      {showNewModal && <NewProjectModal onClose={() => setShowNewModal(false)} />}
    </div>
  );
}

function NewProjectModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState(`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f8fafc; }
    h1 { color: #4f46e5; }
  </style>
</head>
<body>
  <h1>Hello from CodeHost!</h1>
</body>
</html>`);

  const handleSave = async () => {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: "A new hosted snippet",
        type: "snippet",
        files: [{ path: "index.html", content: code, type: "text/html" }]
      })
    });
    if (res.ok) {
      alert("Project created and deployed!");
      onClose();
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Create New Project</h2>
            <p className="text-slate-500 text-sm">Paste your HTML below to host it instantly.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} /></button>
        </div>
        
        <div className="flex-1 p-6 flex flex-col gap-4 overflow-hidden">
          <input 
            type="text" 
            placeholder="Project Name" 
            className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <textarea 
            className="flex-1 p-4 font-mono text-sm outline-none resize-none bg-slate-900 text-slate-300 rounded-xl"
            spellCheck={false}
            value={code}
            onChange={e => setCode(e.target.value)}
          />
        </div>

        <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
          <button onClick={handleSave} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-all font-semibold shadow-lg shadow-indigo-500/20 active:scale-95">
            <Save size={18} /> Deploy Project
          </button>
        </div>
      </div>
    </div>
  );
}

function GalleryView() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then(r => r.json())
      .then(data => {
        setProjects(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Public Gallery</h1>
        <p className="text-slate-500 max-w-2xl">Explore community snippets. One-click deploy to your own site.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {projects.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white">
            <Globe size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-600">No public projects yet</h3>
            <p className="text-slate-400">Be the first to host something amazing!</p>
          </div>
        )}
        {projects.map((p: any) => (
          <div key={p.id} className="group bg-white border rounded-2xl overflow-hidden hover:shadow-2xl hover:shadow-indigo-500/10 transition-all border-slate-200 hover:-translate-y-1 duration-300">
            <div className="h-48 bg-slate-100 flex items-center justify-center border-b border-slate-100 relative">
               <iframe src={`/p/${p.id}`} className="w-full h-full pointer-events-none" title={p.name} scrolling="no" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <a href={`/p/${p.id}`} target="_blank" rel="noopener noreferrer" className="bg-white text-slate-900 px-5 py-2.5 rounded-xl font-bold text-sm shadow-xl flex items-center gap-2 translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                  <Eye size={16} /> Live Preview
                </a>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h3 className="font-bold text-slate-900 text-lg leading-tight">{p.name}</h3>
                <p className="text-sm text-slate-500 mt-2 line-clamp-2">{p.description}</p>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-slate-50 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold">
                    {p.owner_id[0].toUpperCase()}
                  </div>
                  <span className="font-semibold text-slate-600">Developer</span>
                </div>
                <button 
                  onClick={() => {
                    const code = `<script src="${window.location.origin}/embed/${p.id}.js"></script>`;
                    navigator.clipboard.writeText(code);
                    alert("Embed code copied to clipboard!");
                  }}
                  className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors font-medium text-slate-400"
                >
                  <Share2 size={14} /> Embed
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardView({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Workspace</h1>
          <p className="text-slate-500 text-sm font-medium">Manage your hosted code and monitor performance.</p>
        </div>
        <button onClick={onCreate} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-all font-bold shadow-lg shadow-indigo-500/20 active:scale-95">
          <Plus size={18} /> New Project
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b">
              <th className="px-8 py-4">Project</th>
              <th className="px-8 py-4 text-center">Status</th>
              <th className="px-8 py-4 text-center">Views</th>
              <th className="px-8 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[1, 2].map(i => (
              <tr key={i} className="group hover:bg-slate-50/30 transition-colors">
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-xl">
                      <Code2 size={20} />
                    </div>
                    <div className="font-bold text-slate-900 text-sm">Demo Project {i}</div>
                  </div>
                </td>
                <td className="px-8 py-5 text-center">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-100 uppercase">Live</span>
                </td>
                <td className="px-8 py-5 text-center text-sm font-bold text-slate-700">120</td>
                <td className="px-8 py-5 text-right">
                  <ChevronRight size={22} className="text-slate-300 inline" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}