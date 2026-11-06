const fields = {
  tcp6881: document.getElementById('tcp6881'),
  udp6881: document.getElementById('udp6881'),
  tcp8085: document.getElementById('tcp8085'),
};
const upnp = document.getElementById('upnp');
const upnpStatus = document.getElementById('upnp-status');
const refresh = document.getElementById('refresh');

function paintPort(id, free) {
  fields[id].textContent = free ? 'free' : 'in use';
  fields[id].className = free ? 'ok' : 'busy';
}

async function checkPorts() {
  refresh.disabled = true;
  try {
    const ports = await window.seeder.checkPorts();
    paintPort('tcp6881', ports.tcp6881);
    paintPort('udp6881', ports.udp6881);
    paintPort('tcp8085', ports.tcp8085);
  } catch (error) {
    paintPort('tcp6881', false);
    paintPort('udp6881', false);
    paintPort('tcp8085', false);
    upnpStatus.textContent = `Could not check ports: ${error.message}`;
    upnpStatus.className = 'status error';
  } finally {
    refresh.disabled = false;
  }
}

upnp.addEventListener('change', async () => {
  const wanted = upnp.checked;
  upnp.disabled = true;
  upnpStatus.className = 'status';
  upnpStatus.textContent = wanted ? 'Asking the router…' : 'Removing the mapping…';
  try {
    const result = await window.seeder.setUpnp(wanted);
    upnpStatus.textContent = result.on
      ? 'Mapped 6881 TCP and UDP on the router.'
      : 'Off. No mapping is held by the app.';
  } catch (error) {
    upnp.checked = false;
    upnpStatus.className = 'status error';
    upnpStatus.textContent = `Could not map the port: ${error.message}. Forward 6881 manually.`;
  } finally {
    upnp.disabled = false;
    refresh.disabled = false;
  }
});

refresh.addEventListener('click', checkPorts);
checkPorts();
