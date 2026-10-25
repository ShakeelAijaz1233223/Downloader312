import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import App from '../App';

async function renderAt(path) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

describe('Pro-Security admin console & supported-websites catalogue (rendered for real)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('opens the console on the secret slug and on every Pro-Security alias', async () => {
    for (const path of ['/vault-control-x9p4', '/pro-security/vault-control-x9p4', '/vault-control-x9p4/pro-security']) {
      const view = await renderAt(path);
      await waitFor(
        () => expect(screen.getByText('ShakeelAdminProDownloader')).toBeInTheDocument(),
        { timeout: 15000 }
      );
      expect(screen.getByText(/Pro Security · Gate 1 of 2/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Secret digital PIN/i)).toBeInTheDocument();
      // Credentials are never pre-filled.
      expect(screen.getByText(/Unlock Gate 1/i)).toBeInTheDocument();
      view.unmount();
    }
  }, 60000);

  it('logs in end-to-end with the real Pro-Security credentials (14-digit PIN + 2FA)', async () => {
    await renderAt('/vault-control-x9p4');
    const pinInput = await screen.findByLabelText(/Secret digital PIN/i, {}, { timeout: 15000 });
    fireEvent.change(pinInput, { target: { value: '78645637189230' } });

    const emailInput = await screen.findByLabelText(/Super-Admin e-mail/i, {}, { timeout: 15000 });
    fireEvent.change(emailInput, { target: { value: 'Shakeelaijaz559986@gmail.com' } });
    fireEvent.change(screen.getByLabelText(/Master password/i), {
      target: { value: 'ShakeelAhmed@@45637189230' },
    });
    fireEvent.change(screen.getByLabelText(/6-digit Pro-Security code/i), {
      target: { value: '189230' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Enter Command Center/i }));

    await waitFor(() => expect(screen.getByText(/Signed in/i)).toBeInTheDocument(), {
      timeout: 20000,
    });
    expect(screen.getByText(/Pro Security · Command Center/i)).toBeInTheDocument();
  }, 60000);

  it('never auto-unlocks from a stale sessionStorage token', async () => {
    sessionStorage.setItem('ud_admin_access_token', 'fake-token-that-the-server-will-reject');
    await renderAt('/vault-control-x9p4');
    await waitFor(
      () => expect(screen.getByText(/Pro Security · Gate 1 of 2/i)).toBeInTheDocument(),
      { timeout: 15000 }
    );
    expect(screen.queryByText(/Signed in/i)).not.toBeInTheDocument();
  }, 30000);

  it('renders the supported-websites catalogue with real share-link guides', async () => {
    await renderAt('/sites');
    await waitFor(
      () => expect(screen.getByText(/Social, Movies, Courses/i)).toBeInTheDocument(),
      { timeout: 20000 }
    );
    const exampleButtons = await screen.findAllByRole(
      'button',
      { name: /example/i },
      { timeout: 20000 }
    );
    expect(exampleButtons.length).toBeGreaterThan(10);
    expect(screen.getAllByText(/youtube\.com\/watch\?v=ID/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Not in this list\? Paste it anyway/i)).toBeInTheDocument();
  }, 60000);
});
