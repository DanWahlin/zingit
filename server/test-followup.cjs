const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');
let followUpSent = false;

ws.on('open', () => {
  console.log('Connected to server');

  // Select Claude agent
  ws.send(JSON.stringify({ type: 'select_agent', agent: 'claude' }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());

  if (msg.type === 'delta') {
    process.stdout.write(msg.content || '');
  } else if (msg.type === 'tool_start') {
    console.log('\n[tool]', msg.tool);
  } else if (msg.type !== 'checkpoint_created') {
    console.log('\n[' + msg.type + ']', msg.message || msg.agent || '');
  }

  if (msg.type === 'agent_selected') {
    console.log('Sending test question...');
    ws.send(JSON.stringify({
      type: 'batch',
      data: {
        pageUrl: 'http://test.local',
        pageTitle: 'Test Page',
        annotations: [{
          id: 'test-1',
          selector: '.test',
          identifier: 'Test Element',
          html: '<div class="test">Hello</div>',
          notes: 'What is 5 + 3? Just answer with the number, nothing else.'
        }]
      }
    }));
  }

  if (msg.type === 'idle' && !followUpSent) {
    followUpSent = true;
    console.log('\n\n=== SENDING FOLLOW-UP: "multiply that by 2" ===\n');
    ws.send(JSON.stringify({
      type: 'message',
      content: 'Now multiply that result by 2. Just answer with the number, nothing else.'
    }));
  } else if (msg.type === 'idle' && followUpSent) {
    console.log('\n\n=== TEST COMPLETE ===');
    console.log('If the follow-up returned 16, session resume is working!');
    ws.close();
    process.exit(0);
  }
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('\nTest timeout');
  ws.close();
  process.exit(1);
}, 120000);
