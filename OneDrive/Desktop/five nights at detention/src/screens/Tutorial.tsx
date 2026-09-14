import { useState } from "react";
import { asset } from "../paths";

type Props = {
  onClose: () => void;
};

type Page = {
  body: string;
  image?: string;
  next: string;
};

const PAGES: Page[] = [
  {
    body: "Just like normal five nights at freddy's, you gotta survive until 6am.",
    next: "Next Tutorial"
  },
  {
    body: "you see these cameras? These cameras will guide you to each rooms that is in this game.",
    image: asset("assets/ui/camerasview.png"),
    next: "Next Page"
  },
  {
    body: 'if a teacher is camping the basement and wont leave, then just press the "Go away" button, and hold it. And eventually, that will scare off the teacher.',
    next: "Next Page"
  },
  {
    body:
      "Other then that, that is pretty much it for the tutorial. Survive till it reaches 6am, and yeah you win and escape detention. This game will be planning on to get even more scarier, and even more better. So expect more better things.",
    next: "Close."
  }
];

export function Tutorial({ onClose }: Props) {
  const [page, setPage] = useState(0);
  const current = PAGES[page];
  const last = page === PAGES.length - 1;

  const advance = () => {
    if (last) onClose();
    else setPage(page + 1);
  };

  return (
    <div className="veil">
      <div className="slip tutorial">
        <p className="slip-stamp">[ TUTORIAL - HOW TO PLAY. ]</p>
        <p className="tutorial-body">{current.body}</p>
        {current.image && <img className="tutorial-shot" src={current.image} alt="" />}
        <div className="tutorial-foot">
          <div className="tutorial-dots">
            {PAGES.map((_, i) => (
              <i key={i} className={i === page ? "on" : ""} />
            ))}
          </div>
          <div className="tutorial-actions">
            {page > 0 && (
              <button type="button" className="paper-btn dim" onClick={() => setPage(page - 1)}>
                Back
              </button>
            )}
            <button type="button" className="paper-btn" onClick={advance}>
              {current.next}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
