import { Machine } from 'stent';
import { PAGES } from '../constants';
import { enhanceEvent } from '../helpers/enhanceEvent';
import { extractMutatedPaths } from '../helpers/formatStateMutation';

const initialState = () => ({
  name: 'working',
  page: PAGES.DASHBOARD,
  events: [],
  pinnedEvent: null,
  autoscroll: true,
  mutationExplorerPath: null
});
const MAX_EVENTS = 400;

const DevTools = Machine.create('DevTools', {
  state: initialState(),
  transitions: {
    'working': {
      'action received': function ({ events, autoscroll, pinnedEvent, ...rest }, newEvents) {

        // clear events
        if (newEvents.length === 1 && newEvents[0].pageRefresh === true) {
          this.flushEvents(); return undefined;
        }

        const eventsToAdd = newEvents.map((newEvent, i) => {
          var lastKnownState;

          if (typeof newEvent.type === 'undefined') {
            return false;
          }
          if (i === 0) {
            lastKnownState = events.length > 0 ? events[events.length - 1].state : undefined;
          } else {
            lastKnownState = newEvents[i - 1].state;
          }

          return enhanceEvent(newEvent, lastKnownState);
        }).filter(newEvent => newEvent);

        if (eventsToAdd.length === 0) return undefined;

        events = events.concat(eventsToAdd);
        if (events.length > MAX_EVENTS) {
          events.splice(0, events.length - MAX_EVENTS);
        }

        if (autoscroll) {
          pinnedEvent = events[events.length - 1];
        }

        return {
          events,
          autoscroll,
          pinnedEvent,
          ...rest
        };
      },
      'flush events': function () {
        return initialState();
      },
      'add marker': function (state) {
        if (state.pinnedEvent) {
          state.pinnedEvent.withMarker = true;
        }
        return state;
      },
      'pin': function ({ events, pinnedEvent: currentPinnedEvent, ...rest }, id) {
        const event = this.getEventById(id);
        const autoscroll = event.id === events[events.length - 1].id;

        return {
          ...rest,
          autoscroll,
          pinnedEvent: event ? event : currentPinnedEvent,
          events
        };
      },
      'show mutation': function ({ events, ...rest }, mutationExplorerPath) {
        events
          .filter(event => event.stateMutation)
          .map(event => ({
            mutations: extractMutatedPaths(event.stateMutation),
            event
          }))
          .forEach(({ event, mutations }) => {
            event.mutationExplorer = mutations
              .filter(mPath => mPath.toString().indexOf(mutationExplorerPath.toString()) === 0)
              .length > 0;
          });
        return { events, ...rest, mutationExplorerPath };
      },
      'clear mutation': function ({ events, mutationExplorerPath, ...rest}) {
        events.forEach(event => (event.mutationExplorer = false));
        return { events, ...rest, mutationExplorerPath: null };
      }
    }
  },
  getEventById(eventId) {
    return this.state.events.find(({ id }) => id === eventId);
  }
});

export default DevTools;