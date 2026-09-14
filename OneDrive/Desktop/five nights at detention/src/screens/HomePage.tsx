type Props = {
  onPlay: () => void;
  onCredits: () => void;
  onLeaderboard: () => void;
  onSettings: () => void;
  onTutorial: () => void;
  onFeedback: () => void;
};

export function HomePage({ onPlay, onCredits, onLeaderboard, onSettings, onTutorial, onFeedback }: Props) {
  return (
    <div className="home">
      <div className="home-wash" />
      <div className="home-vignette" />
      <div className="home-menu">
        <p className="home-kicker">RIVERDALE HIGH AFTER HOURS</p>
        <h1 className="home-title">
          FIVE NIGHTS
          <span>AT DETENTION</span>
        </h1>
        <div className="home-btns">
          <button className="ghost-btn" onClick={onPlay}>
            Play
          </button>
          <button className="ghost-btn" onClick={onTutorial}>
            Tutorial
          </button>
          <button className="ghost-btn" onClick={onCredits}>
            Credits
          </button>
          <button className="ghost-btn" onClick={onLeaderboard}>
            Leaderboard
          </button>
          <button className="ghost-btn" onClick={onSettings}>
            Settings
          </button>
        </div>
        <button className="ghost-btn ghost-mini" onClick={onFeedback}>
          Feedback
        </button>
      </div>
      <p className="home-foot">BETA BUILD · DO NOT LEAVE YOUR SEAT</p>
    </div>
  );
}
