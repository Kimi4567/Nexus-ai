"use client";

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/components/AuthProvider';
import { 
  Video, 
  Wand2, 
  Clock, 
  BarChart3, 
  Settings,
  Plus,
  Download,
  Share2,
  Trash2
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('create');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [videos, setVideos] = useState([
    { id: 1, title: "Product Launch - Summer Collection", status: "completed", date: "2026-05-20", duration: "0:30", views: 1240 },
    { id: 2, title: "Brand Story - Behind the Scenes", status: "completed", date: "2026-05-18", duration: "1:00", views: 890 },
    { id: 3, title: "Promo - 50% Off Sale", status: "processing", date: "2026-05-22", duration: "0:15", views: 0 },
  ]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);

    // Simulate generation
    setTimeout(() => {
      const newVideo = {
        id: Date.now(),
        title: prompt,
        status: "completed",
        date: new Date().toISOString().split('T')[0],
        duration: "0:30",
        views: 0
      };
      setVideos([newVideo, ...videos]);
      setPrompt('');
      setIsGenerating(false);
    }, 3000);
  };

  const tabs = [
    { id: 'create', label: 'Create Video', icon: <Wand2 className="h-5 w-5" /> },
    { id: 'videos', label: 'My Videos', icon: <Video className="h-5 w-5" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-5 w-5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="h-5 w-5" /> },
  ];

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />

      <div className="pt-20 flex">
        {/* Sidebar */}
        <aside className="w-64 fixed h-full glass border-r border-white/5 hidden md:block">
          <div className="p-6">
            <div className="mb-8">
              <div className="text-sm text-gray-400 mb-1">Current Plan</div>
              <div className="font-semibold text-primary-400">{user?.plan || 'Free'}</div>
              <div className="text-xs text-gray-500 mt-1">3/3 videos used this month</div>
            </div>

            <nav className="space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition ${
                    activeTab === tab.id ? 'bg-primary-600/20 text-primary-400' : 'text-gray-400 hover:bg-white/5'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 md:ml-64 p-6">
          {activeTab === 'create' && (
            <div className="max-w-3xl mx-auto">
              <h1 className="text-3xl font-bold mb-2">Create New Video</h1>
              <p className="text-gray-400 mb-8">Describe your video and let AI do the magic</p>

              <div className="glass rounded-2xl p-8 mb-8">
                <label className="block text-sm font-medium mb-2">Video Description</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Example: Create a 30-second promotional video for my coffee shop, showing our new summer drinks menu with energetic music and vibrant colors..."
                  className="w-full h-32 bg-dark-800 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 resize-none"
                />

                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-400">
                    <Clock className="h-4 w-4 inline mr-1" />
                    Generation time: ~5 minutes
                  </div>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt.trim()}
                    className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-semibold transition flex items-center space-x-2"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-5 w-5" />
                        <span>Generate Video</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="glass rounded-xl p-4">
                  <h3 className="font-semibold mb-2">Quick Templates</h3>
                  <div className="space-y-2">
                    {['Product Launch', 'Brand Story', 'Promo Sale', 'Tutorial'].map((template) => (
                      <button
                        key={template}
                        onClick={() => setPrompt(`Create a ${template.toLowerCase()} video for my business...`)}
                        className="w-full text-left px-4 py-2 rounded-lg hover:bg-white/5 transition text-sm text-gray-300"
                      >
                        {template}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="glass rounded-xl p-4">
                  <h3 className="font-semibold mb-2">Tips for Best Results</h3>
                  <ul className="space-y-2 text-sm text-gray-400">
                    <li>• Be specific about your target audience</li>
                    <li>• Mention desired mood (energetic, calm, professional)</li>
                    <li>• Include key messages you want to convey</li>
                    <li>• Specify video length (15s, 30s, 60s)</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'videos' && (
            <div>
              <h1 className="text-3xl font-bold mb-2">My Videos</h1>
              <p className="text-gray-400 mb-8">Manage and download your created videos</p>

              <div className="space-y-4">
                {videos.map((video) => (
                  <div key={video.id} className="glass rounded-xl p-6 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-primary-900 to-dark-800 rounded-lg flex items-center justify-center">
                        <Video className="h-8 w-8 text-primary-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{video.title}</h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-400 mt-1">
                          <span>{video.date}</span>
                          <span>{video.duration}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            video.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {video.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {video.status === 'completed' && (
                        <>
                          <button className="p-2 hover:bg-white/5 rounded-lg transition" title="Download">
                            <Download className="h-5 w-5 text-gray-400" />
                          </button>
                          <button className="p-2 hover:bg-white/5 rounded-lg transition" title="Share">
                            <Share2 className="h-5 w-5 text-gray-400" />
                          </button>
                        </>
                      )}
                      <button className="p-2 hover:bg-white/5 rounded-lg transition" title="Delete">
                        <Trash2 className="h-5 w-5 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div>
              <h1 className="text-3xl font-bold mb-2">Analytics</h1>
              <p className="text-gray-400 mb-8">Track your video performance</p>

              <div className="grid md:grid-cols-4 gap-6 mb-8">
                <div className="glass rounded-xl p-6">
                  <div className="text-gray-400 text-sm mb-1">Total Videos</div>
                  <div className="text-3xl font-bold">24</div>
                </div>
                <div className="glass rounded-xl p-6">
                  <div className="text-gray-400 text-sm mb-1">Total Views</div>
                  <div className="text-3xl font-bold">45.2K</div>
                </div>
                <div className="glass rounded-xl p-6">
                  <div className="text-gray-400 text-sm mb-1">Avg. Engagement</div>
                  <div className="text-3xl font-bold">8.4%</div>
                </div>
                <div className="glass rounded-xl p-6">
                  <div className="text-gray-400 text-sm mb-1">Videos This Month</div>
                  <div className="text-3xl font-bold">3/3</div>
                </div>
              </div>

              <div className="glass rounded-xl p-6">
                <h3 className="font-semibold mb-4">Recent Performance</h3>
                <div className="space-y-4">
                  {videos.filter(v => v.status === 'completed').map((video) => (
                    <div key={video.id} className="flex items-center justify-between">
                      <span className="text-sm">{video.title}</span>
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="text-gray-400">{video.views.toLocaleString()} views</span>
                        <div className="w-32 h-2 bg-dark-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary-500 rounded-full"
                            style={{ width: `${Math.min((video.views / 2000) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl">
              <h1 className="text-3xl font-bold mb-2">Settings</h1>
              <p className="text-gray-400 mb-8">Manage your account and preferences</p>

              <div className="space-y-6">
                <div className="glass rounded-xl p-6">
                  <h3 className="font-semibold mb-4">Account Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Email</label>
                      <input 
                        type="email" 
                        value={user?.email || ''} 
                        readOnly
                        className="w-full bg-dark-800 border border-white/10 rounded-lg px-4 py-2 text-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Name</label>
                      <input 
                        type="text" 
                        value={user?.name || ''} 
                        className="w-full bg-dark-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="glass rounded-xl p-6">
                  <h3 className="font-semibold mb-4">Brand Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Brand Name</label>
                      <input 
                        type="text" 
                        placeholder="Your brand name"
                        className="w-full bg-dark-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Primary Color</label>
                      <div className="flex items-center space-x-2">
                        <input type="color" className="w-10 h-10 rounded-lg bg-transparent" defaultValue="#0ea5e9" />
                        <span className="text-sm text-gray-400">#0ea5e9</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass rounded-xl p-6">
                  <h3 className="font-semibold mb-4">Subscription</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{user?.plan || 'Free'} Plan</div>
                      <div className="text-sm text-gray-400">3 videos per month</div>
                    </div>
                    <Link 
                      href="/pricing" 
                      className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition"
                    >
                      Upgrade
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
