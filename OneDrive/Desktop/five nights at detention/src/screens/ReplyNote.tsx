import type { SuggestionReply } from "../suggestions";

type Props = {
  note: SuggestionReply;
  onClose: () => void;
};

export function ReplyNote({ note, onClose }: Props) {
  const who = (note.replied_by || "Micah").trim() || "Micah";

  return (
    <div className="veil">
      <div className="slip reply-note">
        <p className="slip-stamp">[ REPLY FROM STAFF ]</p>
        <h3 className="reply-head">&lt;{who}&gt; has replied to your suggestion.</h3>
        {note.title && <p className="reply-ref">{note.title}</p>}
        <p className="reply-yours">“{note.content}”</p>
        <div className="reply-body">
          <p>{note.reply}</p>
        </div>
        <button type="button" className="paper-btn" onClick={onClose}>
          Okay
        </button>
      </div>
    </div>
  );
}
