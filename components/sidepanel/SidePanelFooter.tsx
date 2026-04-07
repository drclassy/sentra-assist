// Designed and constructed by Claudesy.
// A.C.E. Design System — Footer with workspace info

import React from 'react';

interface SidePanelFooterProps {
  workspace: string;
  section: string;
  loadingPatient?: boolean;
}

export const SidePanelFooter: React.FC<SidePanelFooterProps> = ({
  workspace,
  section,
  loadingPatient = false,
}) => {
  const workspaceCode = workspace.replace(/^Puskesmas\s+/i, '').trim() || 'Balowerti';
  const sectionCode = section.replace(/\s+/g, '-');
  const shellState = loadingPatient ? 'LOADING' : 'READY';

  return (
    <div className="footer">
      <div className="footer-author">SENTRA-ASSIST v1.9.2-beta TRIAL | Clinical Validation</div>
      <div className="footer-text">{`WS:${workspaceCode} ${sectionCode} Shell:${shellState}`}</div>
    </div>
  );
};

export { SidePanelFooter as default };
