import { Modal } from "./Modal";
import "./PauseMenu.css";

type PauseAction = {
  label: string;
  onSelect?: () => void;
  href?: string;
};

export function PauseMenu({ actions, onClose }: { actions: PauseAction[]; onClose: () => void }) {
  return (
    <Modal className="pause-menu-dialog" label="暂停菜单" showCloseButton={false} onClose={onClose}>
      {(close) => (
        <>
          <h2>暂停菜单</h2>
          <nav className="pause-menu-actions" aria-label="暂停菜单操作">
            <button autoFocus onClick={() => close()}>
              继续游戏
            </button>
            {actions.map((action) =>
              action.href ? (
                <a
                  key={action.label}
                  href={action.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => close()}
                >
                  {action.label}
                </a>
              ) : (
                <button key={action.label} onClick={() => close(action.onSelect)}>
                  {action.label}
                </button>
              ),
            )}
          </nav>
        </>
      )}
    </Modal>
  );
}
