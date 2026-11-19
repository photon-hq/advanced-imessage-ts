# Message effects by occasion

Each occasion has one `MessageEffect` constant, independent of the language of the message.
Use the constant explicitly with text, attachments, multipart messages or an initial chat message:

```ts
import { MessageEffect } from "@photon-ai/advanced-imessage";

await im.messages.sendText(chatGuid, "You earned it!", {
  effect: MessageEffect.graduation,
});
```

The following 57 occasions reuse nine existing native screen animations. Selecting an occasion
sets the effect ID and preserves your message text. It does not detect keywords or translate text.

**Native** means the occasion-to-animation association was found in macOS 27.0 native resources
or composition behavior. **Product** means an explicit SDK choice of animation for that occasion;
it does not imply Apple automatically recognizes the occasion's name. In particular,
`thinkingOfYou` is a product mapping to Love, not a verified mapping for Apple's similarly named keyword category.

## Milestones and celebrations

| Occasion | Constant | Animation | Mapping |
| --- | --- | --- | --- |
| Happy Birthday | `happyBirthday` | Balloons | Native |
| Congratulations | `congratulations` | Confetti | Native |
| Anniversary | `happyAnniversary` | Love | Product |
| Wedding | `wedding` | Love | Product |
| Engagement | `engagement` | Love | Product |
| Baby Shower | `babyShower` | Balloons | Product |
| New Baby | `newBaby` | Balloons | Product |
| Graduation | `graduation` | Confetti | Product |
| New Job | `newJob` | Balloons | Product |
| Promotion | `promotion` | Confetti | Product |
| Retirement | `retirement` | Confetti | Product |
| Housewarming | `housewarming` | Balloons | Product |
| Achievement | `achievement` | Confetti | Product |
| Victory | `victory` | Fireworks | Product |
| Grand Opening | `grandOpening` | Confetti | Product |
| Product Launch | `productLaunch` | Spotlight | Product |

## Relationships and greetings

| Occasion | Constant | Animation | Mapping |
| --- | --- | --- | --- |
| Thank You | `thankYou` | Love | Product |
| Welcome | `welcome` | Balloons | Product |
| Welcome Back | `welcomeBack` | Confetti | Product |
| Farewell | `farewell` | Shooting Star | Product |
| Good Luck | `goodLuck` | Shooting Star | Product |
| Get Well Soon | `getWellSoon` | Love | Product |
| Thinking of You | `thinkingOfYou` | Love | Product |
| Miss You | `missYou` | Love | Product |
| Love You | `loveYou` | Love | Product |

## Holidays and festivals

| Occasion | Constant | Animation | Mapping |
| --- | --- | --- | --- |
| New Year | `happyNewYear` | Fireworks | Native |
| Lunar New Year | `happyLunarNewYear` | Celebration | Native |
| Valentine's Day | `happyValentinesDay` | Love | Product |
| Mother's Day | `happyMothersDay` | Love | Product |
| Father's Day | `happyFathersDay` | Love | Product |
| Christmas | `merryChristmas` | Celebration | Product |
| Hanukkah | `happyHanukkah` | Celebration | Product |
| Easter | `happyEaster` | Balloons | Product |
| Halloween | `happyHalloween` | Echo | Product |
| Thanksgiving | `happyThanksgiving` | Love | Product |
| St. Patrick's Day | `happyStPatricksDay` | Confetti | Product |
| Independence Day | `happyIndependenceDay` | Fireworks | Product |
| Pride | `happyPride` | Confetti | Product |
| Mid-Autumn Festival | `happyMidAutumnFestival` | Shooting Star | Product |
| Dragon Boat Festival | `happyDragonBoatFestival` | Confetti | Product |
| Lantern Festival | `happyLanternFestival` | Celebration | Product |
| Qixi | `happyQixi` | Love | Product |
| Holi | `happyHoli` | Confetti | Native |
| Diwali | `happyDiwali` | Fireworks | Native |
| Eid | `eidMubarak` | Shooting Star | Native |
| Ramadan | `happyRamadan` | Shooting Star | Native |
| Vesak | `happyVesak` | Celebration | Product |
| Songkran | `happySongkran` | Confetti | Product |
| Nowruz | `happyNowruz` | Fireworks | Product |
| Rosh Hashanah | `happyRoshHashanah` | Fireworks | Product |
| Kwanzaa | `happyKwanzaa` | Celebration | Product |
| Chuseok | `happyChuseok` | Celebration | Product |

## Playful moments

| Occasion | Constant | Animation | Mapping |
| --- | --- | --- | --- |
| Pew Pew | `pewPew` | Lasers | Native |
| Surprise | `surprise` | Spotlight | Product |
| Big News | `bigNews` | Spotlight | Product |
| Countdown | `countdown` | Fireworks | Product |
| Encore | `encore` | Echo | Product |

Existing animation names such as `balloons`, `confetti`, `heart`, `sparkles` and `lasers` remain available.
Shooting Star is present in native resources but absent from Apple's ordinary effect picker.
Playback depends on recipient OS support and effect settings; these aliases do not establish a
rendering guarantee for every recipient. Bubble effects and per-character `TextEffect` values remain separate.
