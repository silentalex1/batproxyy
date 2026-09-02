import { useNavigate } from 'react-router-dom';
import BatMascot from './BatMascot';

const rules = [
  {
    title: '1. Do not snitch about this platform, to teachers.',
    body: 'if i the site owner finds out that you snitch this website to any teachers, or snitch the student thats validated of using this platform, and end up getting that student in trouble from your actions, I\'ll remove your account from this website. As we do not allow that behavior in this platform. As always snitches get stiches :)'
  },
  {
    title: '2. Do not login to another student validated account.',
    body: 'if your not validated in the website, and if you login to that student account that is validated of the website. That student will get their key changed. That student, wont get their account remove they will just get their key invite code changed. Continue doing so, will eventually end up being your account removed.'
  },
  {
    title: '3. Do not be too mean towards the site owner if you know him irl.',
    body: 'if you want to use my platform website, to play games, to watch movies, without experincing lag since this is a private proxy website full of games and movies, then you aren\'t allowed to make fun of me. Making fun of me such as making fun of how i talk, how i speak. I dont mind if you ragebait me there and there, but if i say stop, or whatever then i\'d kindly ask for you to stop and if you want continue to use this site, then you would need to stop.'
  },
  {
    title: '4. [WARNING] snitching the site to principal, or a high up in school.',
    body: 'if i find out, or ended up getting in trouble for no reason. Because some student, snitched on me saying i was the one that made this website and if their using the website. You\'ll be blacklisted and wont be able to use this site or even visit this site. That is worse then getting an account removed.'
  },
  {
    title: '5. Money change - TOS change.',
    body: 'I have every right to make the money to go up if the site alone gets pretty famous, I also have rights to change any of these TOS / add new TOS rules of my site platform as it is my own site platform. Currently the price to get in and to access this private proxy is $5.'
  },
  {
    title: '6. Pay later.',
    body: 'you are allowed to pay later, you\'ll just be put in my pay-later list in my admin panel that i\'ve made. Your due date to pay $5 later is a week though, if you dont end up paying $5 your account will get removed.'
  },
  {
    title: '7. Ai improvement.',
    body: 'By using this site platform, many of you know that I make AI\'s, and currently i am making one called MocahAI, for this site platform at least. I know there are other ai\'s out there, but this AI model, will be custom, and brand new suitable for understanding your teacher pov note styles, etc, so by using this site you\'ll be agreeing to allow me to use your chat messages, of the AI chat history, / soon chat room of this website.'
  }
];

export default function TOS() {
  const navigate = useNavigate();
  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden font-sans text-white flex flex-col items-center">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-repeat opacity-60" style={{ backgroundImage: `radial-gradient(1px 1px at 20px 30px, #fff, rgba(0,0,0,0)), radial-gradient(1.5px 1.5px at 40px 70px, #fff, rgba(0,0,0,0))`, backgroundSize: '350px 350px' }} />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28rem] h-[28rem] bg-purple-600/30 rounded-full blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.55)_70%,#000_100%)]" />
      </div>
      <div className="relative z-10 w-full max-w-3xl px-4 py-10 flex flex-col items-center">
        <button onClick={() => navigate('/')} className="w-24 h-24 rounded-[28px] bg-gradient-to-br from-purple-600 via-purple-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-purple-600/40 mb-6 hover:scale-105 transition-transform">
          <BatMascot size={86} />
        </button>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2" style={{ color: 'var(--bp-accent)' }}>Terms of Service</h1>
        <p className="text-white/40 text-sm mb-8">Bat Prox — stealthybat.org</p>
        <div className="w-full bg-black/55 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl space-y-6">
          {rules.map((r, i) => (
            <div key={i} className="rounded-2xl bg-white/[0.04] border border-white/10 p-5">
              <h2 className="text-sm font-semibold text-purple-300 mb-2">{r.title}</h2>
              <p className="text-sm text-white/70 leading-relaxed">{r.body}</p>
            </div>
          ))}
        </div>
        <button onClick={() => navigate('/')} className="mt-8 px-8 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-sm font-medium">Back to login</button>
      </div>
    </div>
  );
}
