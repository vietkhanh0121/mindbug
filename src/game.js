import { createMindbugBot } from "./bot-player.js?v=26";
import { GameAnimations } from "./game-animations.js?v=4";
import { getSfxVolume, getSfxVolumeLevel, playSoundEffect, setSfxVolumeLevel, unlockAudio } from "./sound.js?v=13";
import { io } from "socket.io-client";

const CARD_BASE_WIDTH = 230;
const CARD_BASE_HEIGHT = 350;
const CARD_ASPECT_RATIO = CARD_BASE_WIDTH / CARD_BASE_HEIGHT;
const APP_DESIGN_WIDTH = 390;
const APP_DESIGN_HEIGHT = 740;
const TARGET_MOTION_FPS = 60;
const APP_ROOT_URL = new URL(import.meta.env.BASE_URL, window.location.href);
let motionDurationScale = 1;
let viewportScaleLockedForKeyboard = false;
let viewportScaleUnlockTimer = 0;

const RAW_CARDS = [
  ["Shark Dog", 1, 4, ["HUNTER"], "Attack: Defeat an enemy creature with power 6 or more"],
  ["Mysterious Mermaid", 1, 7, [], "Play: Set your life points equal to the opponent's"],
  ["Shark Crab-Dog Mummypus", 1, 5, [], "Constant: Has HUNTER, SNEAKY, FRENZY, POISONOUS while an enemy creature does"],
  ["Bee Bear", 1, 8, [], "Constant: Cannot be blocked by creatures with power 6 or less"],
  ["Urchin Hurler", 1, 5, ["HUNTER"], "Constant: Other allied creatures have +2 power while it is your turn"],
  ["Ferret Bomber", 2, 2, ["SNEAKY"], "Play: The opponent chooses and discards 2 cards"],
  ["Explosive Toad", 2, 5, ["FRENZY"], "Defeated: Defeat an enemy creature"],
  ["Compost Dragon", 2, 3, ["HUNTER"], "Play: Play a card from your discard pile"],
  ["Plated Scorpion", 2, 2, ["TOUGH", "POISONOUS"], "NONE"],
  ["Axolotl Healer", 2, 4, ["POISONOUS"], "Play: Gain 2 life points"],
  ["Elephantopus", 1, 7, ["TOUGH"], "Constant: The opponent cannot block with creatures with power 4 or less"],
  ["Killer Bee", 2, 5, ["HUNTER"], "Play: The opponent loses 1 life point"],
  ["Grave Robber", 2, 7, ["TOUGH"], "Play: Play a card from the opponent's discard pile"],
  ["Giraffodile", 1, 7, [], "Play: Draw your entire discard pile"],
  ["Goblin Werewolf", 2, 2, ["HUNTER"], "Constant: Has +6 power while it is your turn"],
  ["Luchataur", 2, 9, ["FRENZY"], "NONE"],
  ["Snail Hydra", 2, 9, [], "Attack: If you control fewer creatures than the opponent, defeat a monster"],
  ["Strange Barrel", 1, 6, [], "Defeated: Steal 2 random cards from the opponent's hand"],
  ["Deathweaver", 1, 2, ["POISONOUS"], "Constant: The opponent cannot activate play effects"],
  ["Turbo Bug", 1, 4, [], "Attack: The opponent loses all life point except one"],
  ["Lone Yeti", 1, 5, ["TOUGH"], "Constant: While this is your only allied creature, it has +5 power and FRENZY"],
  ["Harpy Mother", 1, 5, [], "Defeated: Take control of up to 2 creatures with power 5 or less"],
  ["Gorillion", 1, 10, [], "NONE"],
  ["Rhino Turtle", 2, 8, ["FRENZY", "TOUGH"], "NONE"],
  ["Shield Bugs", 2, 4, ["TOUGH"], "Constant: Other allied creatures have +1 power"],
  ["Brain Fly", 1, 4, [], "Play: Take control of a creature with power 6 or more"],
  ["Chameleon Sniper", 1, 1, ["SNEAKY"], "Attack: The opponent loses 1 life point"],
  ["Snail Thrower", 1, 1, ["POISONOUS"], "Constant: Other allied creatures with power 4 or less have HUNTER and POISONOUS"],
  ["Kangasaurus Rex", 2, 7, [], "Play: Defeat all enemy creatures with power 4 or less"],
  ["Spider Owl", 2, 3, ["SNEAKY", "POISONOUS"], "NONE"],
  ["Tiger Squirrel", 2, 3, ["SNEAKY"], "Play: Defeat an enemy creature with power of 7 or more"],
  ["Tusked Exporter", 2, 8, [], "Attack: The opponent chooses and discards a card"],
  ["Bugserker", 2, 3, ["TOUGH"], "Constant: Has +8 power while you have 1 life point left"],
  ["Count Draculeech", 2, 7, [], "Attack: You lose 1 life point. Defeat a creature"],
  ["Creep From The Deep", 2, 4, ["POISONOUS", "HUNTER"], "NONE"],
  ["Ferret Pacifier", 2, 4, [], "Constant: The enemy creature(s) with the highest power can't block"],
  ["Froblin Instigator", 2, 1, ["HUNTER"], "Constant: Has +2 power for each other allied creature"],
  ["Goreagle Alpha", 2, 6, ["FRENZY", "HUNTER", "TOUGH"], "Play: You lose 1 life point"],
  ["Hamster Lion", 2, 8, ["FRENZY"], "Constant: The enemy creature(s) with the lowest power can't attack"],
  ["Hungry Hungry Hamster", 2, 2, ["SNEAKY"], "Play: The opponent gives you a card from their hand"],
  ["Hyenix", 2, 7, ["FRENZY"], "Constant: When you lose life while this is in your discard pile, play it"],
  ["Majestic Manticore", 2, 6, ["POISONOUS"], "Attack: Defeat the creature(s) with the lowest power among all creatures in play"],
  ["The Lurker", 2, 4, ["TOUGH"], "Attack: If you control more creatures than the opponent, this has SNEAKY this turn"],
  ["Turf The Surfer", 2, 8, [], "Attack: Choose a creature. It cannot block this turn"],
  ["Cloud Lady", 1, 4, [], "Action: Defeat an enemy creature with power 4 or less. Evolve into Typhoon Princess."],
  ["Curious Tadpole", 1, 1, ["POISONOUS"], "Action: Gain 1 life point. Evolve into Frog Prophet."],
  ["Waddling Recruit", 1, 3, [], "Action: The opponent discards a card. Evolve into Veteran Penguin."]
];

const BEYOND_EVOLUTION_CARDS = [
  ["Blastfish", 1, 1, ["POISONOUS"], "Attack: This cannot be defeated this turn."],
  ["Bullet Train", 2, 9, [], "Attack: Defeat an enemy creature with power 3 or less."],
  ["Cake Trickster", 2, 6, ["POISONOUS"], "Action: Choose an enemy creature. The opponent attacks with it if able."],
  ["Captain Hippo", 1, 7, ["FRENZY"], "During the opponent's turn, they must always attack this with a creature with HUNTER if able."],
  ["Cheeky Chimpborg", 1, 5, ["HUNTER"], "Play: The opponent discards a card for each creature they control."],
  ["Cheery Chimpborg", 1, 5, ["HUNTER"], "While there are 3 or more enemy creatures, this has +5 power."],
  ["Chuckling Chimpborg", 1, 5, ["HUNTER"], "Play: The opponent loses 1 life for each Mindbug they have."],
  ["Coach Panda", 2, 6, [], "While there is exactly 1 other allied creature, that creature has +3 power and FRENZY."],
  ["Dr. Orange U. Tan", 1, 6, [], "Play: You may lose 1 life. If you do, return all enemy creatures to the opponent's hand."],
  ["Dragon Inn", 2, 3, ["TOUGH"], "Action: If you control fewer creatures than the opponent, they lose 1 life."],
  ["Earwig Assassin", 2, 1, ["SNEAKY"], "Play: You may discard a card. If you do, defeat any creature."],
  ["Infernostrich", 1, 6, [], "Action: Defeat an enemy creature with power 7 or more."],
  ["Kitsunsei", 1, 4, [], "Other allied creatures have SNEAKY."],
  ["Mole Machine", 2, 5, ["TOUGH"], "The opponent cannot block with creatures with power 7 or more."],
  ["Octocopter", 1, 5, [], "Action: Defeat this. Take control of an enemy creature."],
  ["Puffermech", 2, 2, ["POISONOUS"], "Defeated: Defeat all enemy creatures with power 8 or more."],
  ["Radioactive Rabbit", 1, 3, ["FRENZY"], "Play: The opponent takes control of this. Defeated: Defeat all other allied creatures."],
  ["Robopup", 2, 1, ["SNEAKY", "TOUGH"], "NONE"],
  ["Sawn", 2, 5, ["TOUGH"], "When this fights, the creature with the highest power is defeated instead of the lowest."],
  ["Spiky Shinobi", 2, 3, ["SNEAKY"], "While you have no Mindbugs, this has +5 power."],
  ["Steelhorn", 1, 7, [], "Defeated: The opponent discards 3 cards."],
  ["Sweet Fighter", 2, 9, [], "Defeated: Gain 2 life."],
  ["The Experiment", 1, 6, ["POISONOUS"], "Play: The opponent takes control of this. Take control of an enemy creature."],
  ["Turtle Toaster", 2, 4, ["TOUGH"], "Play: Defeat up to 2 enemy creatures with power from 4 to 6."],
  ["Utility Bug", 2, 4, ["HUNTER", "TOUGH"], "Play: You may copy the Play effect of another creature."],
  ["Westside Monster", 2, 8, ["FRENZY"], "Enemy creatures with SNEAKY cannot attack or block."]
];

const EXTRA_CARD_SPECS = [
  ["Typhoon Princess", 1, 6, [], "Action: Defeat an enemy creature with power 6 or less. Evolve into Thunder Queen."],
  ["Thunder Queen", 1, 9, [], "Attack: Defeat an enemy creature."],
  ["Frog Prophet", 1, 3, ["POISONOUS", "TOUGH"], "Action: Gain 1 life point. Evolve into World Eater."],
  ["World Eater", 1, 8, ["POISONOUS", "TOUGH"], "Attack: The opponent loses 1 life point."],
  ["Veteran Penguin", 1, 5, ["TOUGH"], "Action: The opponent discards a card. Evolve into Frosty Fortress."],
  ["Frosty Fortress", 1, 10, ["TOUGH"], "Attack: The opponent discards their hand."]
];

const ALL_CARD_SPECS = [...RAW_CARDS, ...EXTRA_CARD_SPECS, ...BEYOND_EVOLUTION_CARDS];
const EVOLUTION_INFO = {
  "Cloud Lady": { level: 1, evolution: "Typhoon Princess", root: "Cloud Lady" },
  "Typhoon Princess": { level: 2, evolution: "Thunder Queen", root: "Cloud Lady" },
  "Thunder Queen": { level: 3, evolution: "", root: "Cloud Lady" },
  "Curious Tadpole": { level: 1, evolution: "Frog Prophet", root: "Curious Tadpole" },
  "Frog Prophet": { level: 2, evolution: "World Eater", root: "Curious Tadpole" },
  "World Eater": { level: 3, evolution: "", root: "Curious Tadpole" },
  "Waddling Recruit": { level: 1, evolution: "Veteran Penguin", root: "Waddling Recruit" },
  "Veteran Penguin": { level: 2, evolution: "Frosty Fortress", root: "Waddling Recruit" },
  "Frosty Fortress": { level: 3, evolution: "", root: "Waddling Recruit" }
};
const ACTION_ABILITY_CARDS = new Set([
  ...Object.keys(EVOLUTION_INFO).filter(name => EVOLUTION_INFO[name].evolution),
  "Cake Trickster",
  "Dragon Inn",
  "Infernostrich",
  "Octocopter"
]);

const PLAY_ABILITY_CARDS = new Set([
  "Mysterious Mermaid",
  "Ferret Bomber",
  "Compost Dragon",
  "Axolotl Healer",
  "Killer Bee",
  "Grave Robber",
  "Giraffodile",
  "Brain Fly",
  "Kangasaurus Rex",
  "Tiger Squirrel",
  "Goreagle Alpha",
  "Hungry Hungry Hamster",
  "Cheeky Chimpborg",
  "Chuckling Chimpborg",
  "Dr. Orange U. Tan",
  "Earwig Assassin",
  "The Experiment",
  "Utility Bug",
  "Radioactive Rabbit",
  "Turtle Toaster"
]);
const ATTACK_ABILITY_CARDS = new Set([
  "Shark Dog",
  "Snail Hydra",
  "Turbo Bug",
  "Chameleon Sniper",
  "Tusked Exporter",
  "Count Draculeech",
  "Majestic Manticore",
  "The Lurker",
  "Turf The Surfer",
  "Thunder Queen",
  "World Eater",
  "Frosty Fortress",
  "Blastfish",
  "Bullet Train"
]);
const DEFEATED_ABILITY_CARDS = new Set([
  "Strange Barrel",
  "Harpy Mother",
  "Explosive Toad",
  "Puffermech",
  "Radioactive Rabbit",
  "Steelhorn",
  "Sweet Fighter"
]);

function hasPrintedPlayAbility(card) {
  return /^play\s*:/i.test(String(card?.ability ?? "").trim());
}

const CARD_SPRITE_FILES = {
  "Shark Dog": "Shark Dog.png",
  "Mysterious Mermaid": "Mysterious mermaid.png",
  "Shark Crab-Dog Mummypus": "Shark Crab-Dog Mummypus.png",
  "Bee Bear": "Bee Bear.png",
  "Urchin Hurler": "Urchin Hurler.png",
  "Ferret Bomber": "Ferret Bomber.png",
  "Explosive Toad": "Explosive toad.png",
  "Compost Dragon": "Compost Dragon.png",
  "Plated Scorpion": "Plated Scorpion.png",
  "Axolotl Healer": "Axolotl Healer.png",
  "Elephantopus": "Elephantopus.png",
  "Killer Bee": "Killer Bee.png",
  "Grave Robber": "Grave Robber.png",
  "Giraffodile": "Giraffodile.png",
  "Goblin Werewolf": "Goblin werewolf.png",
  "Luchataur": "Luchataur.png",
  "Snail Hydra": "Snail Hydra.png",
  "Strange Barrel": "Strange Barrel.png",
  "Deathweaver": "Deathweaver.png",
  "Turbo Bug": "Turbo Bug.png",
  "Lone Yeti": "Lone Yeti.png",
  "Harpy Mother": "Harpy Mother.png",
  "Gorillion": "Gorillion.png",
  "Rhino Turtle": "Rhino Turtle.png",
  "Shield Bugs": "Shield Bugs.png",
  "Brain Fly": "Brain fly.png",
  "Chameleon Sniper": "Chameleon Sniper.png",
  "Snail Thrower": "Snail thrower.png",
  "Kangasaurus Rex": "Kangasaurus Rex.png",
  "Spider Owl": "Spider owl.png",
  "Tiger Squirrel": "Tiger Squirrel.png",
  "Tusked Exporter": "Tusked Exporter.png",
  "Bugserker": "Bugserker.png",
  "Count Draculeech": "Count Draculeech.png",
  "Creep From The Deep": "Creep From The Deep.png",
  "Ferret Pacifier": "Ferret Pacifier.png",
  "Froblin Instigator": "Froblin Instigator.png",
  "Goreagle Alpha": "Goreagle Alpha.png",
  "Hamster Lion": "Hamster Lion.png",
  "Hungry Hungry Hamster": "Hungry Hungry Hamster.png",
  "Hyenix": "Hyenix.png",
  "Majestic Manticore": "Majestic Manticore.png",
  "The Lurker": "The Lurker.png",
  "Turf The Surfer": "Turf The Surfer.png",
  "Cloud Lady": "Cloud Lady.png",
  "Typhoon Princess": "Typhoon Princess.png",
  "Thunder Queen": "Thunder Queen.png",
  "Curious Tadpole": "Curious Tadpole.png",
  "Frog Prophet": "Frog Prophet.png",
  "World Eater": "World Eater.png",
  "Waddling Recruit": "Waddling Recruit.png",
  "Veteran Penguin": "Veteran Penguin.png",
  "Frosty Fortress": "Frosty Fortress.png"
  ,"Blastfish": "Blastfish.png"
  ,"Bullet Train": "Bullet Train.png"
  ,"Cake Trickster": "Cake Trickster.png"
  ,"Captain Hippo": "Captain Hippo.png"
  ,"Cheeky Chimpborg": "Cheeky Chimpborg.png"
  ,"Cheery Chimpborg": "Cheery Chimpborg.png"
  ,"Chuckling Chimpborg": "Chuckling Chimpborg.png"
  ,"Coach Panda": "Coach Panda.png"
  ,"Dr. Orange U. Tan": "Dr. Orange U. Tan.png"
  ,"Dragon Inn": "Dragon Inn.png"
  ,"Earwig Assassin": "Earwig Assassin.png"
  ,"Infernostrich": "Infernostrich.png"
  ,"Kitsunsei": "Kitsunsei.png"
  ,"Mole Machine": "Mole Machine.png"
  ,"Octocopter": "Octocopter.png"
  ,"Puffermech": "Puffermech.png"
  ,"Radioactive Rabbit": "Radioactive Rabbit.png"
  ,"Robopup": "Robopup.png"
  ,"Sawn": "Sawn.png"
  ,"Spiky Shinobi": "Spiky Shinobi.png"
  ,"Steelhorn": "Steelhorn.png"
  ,"Sweet Fighter": "Sweet Fighter.png"
  ,"The Experiment": "The Experiment.png"
  ,"Turtle Toaster": "Turtle Toaster.png"
  ,"Utility Bug": "Utility Bug.png"
  ,"Westside Monster": "Westside Monster.png"
};

const STATIC_PRELOAD_ASSETS = [
  new URL("assets/background/map.jpg", APP_ROOT_URL).href,
  new URL("assets/cards/card_back.png", APP_ROOT_URL).href,
  new URL("assets/ui/win.png", APP_ROOT_URL).href,
  new URL("assets/ui/lose.png", APP_ROOT_URL).href
];
const WATERDROP_FX_FRAMES = Array.from({ length: 9 }, (_, index) => (
  new URL(`assets/fx/waterdrop/frame_${String(index).padStart(3, "0")}.png`, APP_ROOT_URL).href
));

const KEYWORD_LABELS = {
  FRENZY: "ĐÁNH 2 LẦN",
  HUNTER: "BẮN TỈA",
  POISONOUS: "ĐỘC",
  SNEAKY: "TÀNG HÌNH",
  TOUGH: "KHIÊN"
};

const CARD_NAME_LABELS = {
  "Shark Dog": "Đậu Bắn Cung",
  "Mysterious Mermaid": "Sen LP",
  "Shark Crab-Dog Mummypus": "Cúc Bắt Chước",
  "Bee Bear": "Bông Cải Hùng Hục",
  "Urchin Hurler": "Ly Buff Dam",
  "Ferret Bomber": "Ớt Đỏ Cay Cú",
  "Explosive Toad": "Cherry Sát Thủ",
  "Compost Dragon": "Cây Đa Hồi Sinh",
  "Plated Scorpion": "Ớt Xanh Chín",
  "Axolotl Healer": "Oải Hương Hồi Máu",
  "Elephantopus": "Thông Tiến Công",
  "Killer Bee": "Dương Sỉ Vả",
  "Grave Robber": "Dứa Đào Mộ",
  "Giraffodile": "Việt Quất Mộ",
  "Goblin Werewolf": "Nho Nhấm Nhẳng",
  "Luchataur": "Xương Rồng 2 Lần",
  "Snail Hydra": "Cam Hiệp Sĩ",
  "Strange Barrel": "Bí Cướp Bóc",
  "Deathweaver": "Nấm Ngăn Cấm",
  "Turbo Bug": "Ngô 1 L",
  "Lone Yeti": "Dừa Cô Độc",
  "Harpy Mother": "Hướng Dương Phù",
  "Gorillion": "Củ Cải Căng Cực",
  "Rhino Turtle": "Tre Thiết Giáp",
  "Shield Bugs": "Sen Đá Cứng Đầu",
  "Brain Fly": "Dưa Hấu Tướng Quân",
  "Chameleon Sniper": "Chanh Trừ Máu",
  "Snail Thrower": "Khoai Khoái Bạn",
  "Kangasaurus Rex": "Bơ Bực Bội",
  "Spider Owl": "Hồng Hậm Hực",
  "Tiger Squirrel": "Cải Cau Có",
  "Tusked Exporter": "Tỏi Tức Tưởi",
  "Bugserker": "Bọ Cuồng Khiên",
  "Count Draculeech": "Củ Dền Hút Máu",
  "Creep From The Deep": "Rêu Sâu Độc",
  "Ferret Pacifier": "Cà Rốt Ru Ngủ",
  "Froblin Instigator": "Mầm Kích Động",
  "Goreagle Alpha": "Đại Bàng Gai",
  "Hamster Lion": "Sư Tử Hạt Dẻ",
  "Hungry Hungry Hamster": "Chuột Hamster Háu Ăn",
  "Hyenix": "Linh Cẩu Hồi Sinh",
  "Majestic Manticore": "Su Hào Xui Xẻo",
  "The Lurker": "Kẻ Rình Rập",
  "Turf The Surfer": "Cỏ Lướt Sóng",
  "Cloud Lady": "Cô Mây",
  "Typhoon Princess": "Công Chúa Bão",
  "Thunder Queen": "Nữ Hoàng Sấm",
  "Curious Tadpole": "Nòng Nọc Tò Mò",
  "Frog Prophet": "Ếch Tiên Tri",
  "World Eater": "Kẻ Nuốt Thế Giới",
  "Waddling Recruit": "Tân Binh Lạch Bạch",
  "Veteran Penguin": "Cựu Binh Chim Cánh Cụt",
  "Frosty Fortress": "Pháo Đài Băng Giá"
};

const ABILITY_LABELS = {
  "Shark Dog": "Khi tấn công: Hạ 1 Quái vật địch có tấn công từ 6 trở lên.",
  "Mysterious Mermaid": "Khi vào sân: Đặt LP của bạn bằng LP của đối thủ.",
  "Shark Crab-Dog Mummypus": "Có BẮN TỈA / TÀNG HÌNH / ĐÁNH 2 LẦN / ĐỘC khi có Quái vật địch sở hữu từ khóa đó.",
  "Bee Bear": "Không thể bị chặn bởi Quái vật có tấn công từ 6 trở xuống.",
  "Urchin Hurler": "Các Quái vật đồng minh khác được +2 tấn công trong lượt của bạn.",
  "Ferret Bomber": "Khi vào sân: Đối thủ chọn và bỏ 2 lá bài.",
  "Explosive Toad": "Khi chết: Hạ 1 Quái vật đối thủ.",
  "Compost Dragon": "Khi vào sân: Chơi 1 lá từ Mộ bài của bạn.",
  "Plated Scorpion": "Không có hiệu ứng.",
  "Axolotl Healer": "Khi vào sân: Hồi 2 LP.",
  "Elephantopus": "Đối thủ không thể chặn bằng Quái vật có tấn công từ 4 trở xuống.",
  "Killer Bee": "Khi vào sân: Đối thủ mất 1 LP.",
  "Grave Robber": "Khi vào sân: Chơi 1 lá từ Mộ bài của đối thủ.",
  "Giraffodile": "Khi vào sân: Rút toàn bộ Mộ bài của bạn lên tay.",
  "Goblin Werewolf": "Được +6 tấn công trong lượt của bạn.",
  "Luchataur": "Không có hiệu ứng.",
  "Snail Hydra": "Khi tấn công: Nếu bạn kiểm soát ít Quái vật hơn đối thủ, hạ 1 quái vật.",
  "Strange Barrel": "Khi chết: Cướp ngẫu nhiên 2 lá từ tay đối thủ.",
  "Deathweaver": "Đối thủ không thể kích hoạt hiệu ứng Khi vào sân.",
  "Turbo Bug": "Khi tấn công: Đối thủ mất toàn bộ LP, chỉ còn 1.",
  "Lone Yeti": "Nếu đây là Quái vật đồng minh duy nhất của bạn, nó được +5 tấn công và ĐÁNH 2 LẦN.",
  "Harpy Mother": "Khi chết: Chiếm quyền điều khiển tối đa 2 Quái vật có tấn công từ 5 trở xuống.",
  "Gorillion": "Không có hiệu ứng.",
  "Rhino Turtle": "Không có hiệu ứng.",
  "Shield Bugs": "Các Quái vật đồng minh khác được +1 tấn công.",
  "Brain Fly": "Khi vào sân: Chiếm quyền điều khiển 1 Quái vật có tấn công từ 6 trở lên.",
  "Chameleon Sniper": "Khi tấn công: Đối thủ mất 1 LP.",
  "Snail Thrower": "Các Quái vật đồng minh khác có tấn công từ 4 trở xuống có BẮN TỈA và ĐỘC.",
  "Kangasaurus Rex": "Khi vào sân: Hạ toàn bộ Quái vật địch có tấn công từ 4 trở xuống.",
  "Spider Owl": "Không có hiệu ứng.",
  "Tiger Squirrel": "Khi vào sân: Hạ 1 Quái vật địch có tấn công từ 7 trở lên.",
  "Tusked Exporter": "Khi tấn công: Đối thủ chọn và bỏ 1 lá bài.",
  "Bugserker": "Được +8 tấn công khi bạn còn đúng 1 LP.",
  "Count Draculeech": "Khi tấn công: Bạn mất 1 LP. Hạ 1 Quái vật.",
  "Creep From The Deep": "Không có hiệu ứng.",
  "Ferret Pacifier": "Quái vật địch có tấn công cao nhất không thể chặn.",
  "Froblin Instigator": "Được +2 tấn công với mỗi Quái vật đồng minh khác.",
  "Goreagle Alpha": "Khi vào sân: Bạn mất 1 LP.",
  "Hamster Lion": "Quái vật địch có tấn công thấp nhất không thể tấn công.",
  "Hungry Hungry Hamster": "Khi vào sân: Đối thủ đưa bạn 1 lá từ tay.",
  "Hyenix": "Khi ở dưới Mộ bài: Nếu bạn mất LP, lá này tự vào sân.",
  "Majestic Manticore": "Khi tấn công: So sánh toàn bộ Quái vật trên sân và hạ các Quái vật có tấn công thấp nhất.",
  "The Lurker": "Khi tấn công: Nếu bạn có nhiều Quái vật hơn đối thủ, lá này có TÀNG HÌNH lượt này.",
  "Turf The Surfer": "Khi tấn công: Chọn 1 Quái vật. Nó không thể chặn trong lượt này.",
  "Cloud Lady": "Khi Được tưới: Hạ 1 Quái vật địch có Tấn công từ 4 trở xuống. Tiến hóa thành Công Chúa Bão.",
  "Typhoon Princess": "Khi Được tưới: Hạ 1 Quái vật địch có Tấn công từ 6 trở xuống. Tiến hóa thành Nữ Hoàng Sấm.",
  "Thunder Queen": "Khi tấn công: Hạ 1 Quái vật địch.",
  "Curious Tadpole": "Khi Được tưới: +1 LP. Tiến hóa thành Ếch Tiên Tri.",
  "Frog Prophet": "Khi Được tưới: +1 LP. Tiến hóa thành Kẻ Nuốt Thế Giới.",
  "World Eater": "Khi tấn công: Đối thủ mất 1 LP.",
  "Waddling Recruit": "Khi Được tưới: Đối thủ bỏ 1 lá. Tiến hóa thành Cựu Binh Chim Cánh Cụt.",
  "Veteran Penguin": "Khi Được tưới: Đối thủ bỏ 1 lá. Tiến hóa thành Pháo Đài Băng Giá.",
  "Frosty Fortress": "Khi tấn công: Đối thủ bỏ toàn bộ bài trên tay."
};

const ABILITY_SUPPORT_NOTES = {
};

const TARGET_DECK_SIZE = 72;
const HAND_SIZE = 5;
const STARTING_DRAW = 5;
const STARTING_LIFE = 3;
const STARTING_MINDBUGS = 2;
const CREATURE_ABILITIES_ENABLED = true;
const MINDBUG_SOURCE_ZONE = "hand";
const BOARD_ROW_CAPACITY = 5;
const ATTACK_INTENT_ENTER_MS = 180;
const ATTACK_INTENT_EXIT_MS = 150;
const ATTACK_INTENT_TARGET_TURN_MS = 180;
const ATTACK_FACE_TRAVEL_MS = 320;
const BOARD_CARD_EXIT_MS = 240;
const BOT_PLAY_REVEAL_MS = 900;
const HYENIX_REVEAL_HOLD_MS = 600;

const els = {
  arena: document.querySelector("#arena"),
  opponentInfo: document.querySelector("#opponentInfo"),
  playerOneInfo: document.querySelector("#playerOneInfo"),
  opponentHand: document.querySelector("#opponentHand"),
  opponentHandActions: document.querySelector("#opponentHandActions"),
  opponentPendingAbilityOverlay: document.querySelector("#opponentPendingAbilityOverlay"),
  opponentPendingAbilityTitle: document.querySelector("#opponentPendingAbilityTitle"),
  opponentPendingAbilityText: document.querySelector("#opponentPendingAbilityText"),
  hand: document.querySelector("#hand"),
  localHandActions: document.querySelector("#localHandActions"),
  statusText: document.querySelector("#statusText"),
  lobbyView: document.querySelector("#lobbyView"),
  lobbyProfileChip: document.querySelector("#lobbyProfileChip"),
  lobbyProfileChipAvatar: document.querySelector("#lobbyProfileChipAvatar"),
  lobbyProfileChipName: document.querySelector("#lobbyProfileChipName"),
  lobbyHeroCards: document.querySelector("#lobbyHeroCards"),
  lobbySettingsButton: document.querySelector("#lobbySettingsButton"),
  lobbySettingsOverlay: document.querySelector("#lobbySettingsOverlay"),
  lobbySettingsCloseButton: document.querySelector("#lobbySettingsCloseButton"),
  lobbySfxVolumeSlider: document.querySelector("#lobbySfxVolumeSlider"),
  lobbySfxVolumeValue: document.querySelector("#lobbySfxVolumeValue"),
  lobbyTitle: document.querySelector("#lobbyTitle"),
  lobbySubtitle: document.querySelector("#lobbySubtitle"),
  lobbyPreloadOverlay: document.querySelector("#lobbyPreloadOverlay"),
  lobbyPreloadBar: document.querySelector("#lobbyPreloadBar"),
  lobbyPreloadFill: document.querySelector("#lobbyPreloadFill"),
  lobbyPreloadPercent: document.querySelector("#lobbyPreloadPercent"),
  lobbyProfileView: document.querySelector("#lobbyProfileView"),
  lobbyProfileCloseButton: document.querySelector("#lobbyProfileCloseButton"),
  lobbyModeView: document.querySelector("#lobbyModeView"),
  lobbySetupView: document.querySelector("#lobbySetupView"),
  lobbyDuelView: document.querySelector("#lobbyDuelView"),
  lobbyWaitingView: document.querySelector("#lobbyWaitingView"),
  lobbyProfileContinueButton: document.querySelector("#lobbyProfileContinueButton"),
  lobbyStartButton: document.querySelector("#lobbyStartButton"),
  lobbyBackButton: document.querySelector("#lobbyBackButton"),
  lobbyDuelBackButton: document.querySelector("#lobbyDuelBackButton"),
  lobbyCreateRoomButton: document.querySelector("#lobbyCreateRoomButton"),
  lobbyJoinRoomButton: document.querySelector("#lobbyJoinRoomButton"),
  lobbyWaitingBackButton: document.querySelector("#lobbyWaitingBackButton"),
  lobbyRoomStartButton: document.querySelector("#lobbyRoomStartButton"),
  lobbyRoomCodeInput: document.querySelector("#lobbyRoomCodeInput"),
  lobbyRoomCode: document.querySelector("#lobbyRoomCode"),
  lobbyDuelNote: document.querySelector("#lobbyDuelNote"),
  lobbyWaitingText: document.querySelector("#lobbyWaitingText"),
  lobbyWaitingSlots: document.querySelector("#lobbyWaitingSlots"),
  lobbyWaitingGuestSlot: document.querySelector("#lobbyWaitingGuestSlot"),
  lobbyModeSolo: document.querySelector("#lobbyModeSolo"),
  lobbyModeDuel: document.querySelector("#lobbyModeDuel"),
  lobbyModeNote: document.querySelector("#lobbyModeNote"),
  lobbyPlayerName: document.querySelector("#lobbyPlayerName"),
  lobbyAvatarPreview0: document.querySelector("#lobbyAvatarPreview0"),
  lobbyAvatarPreview1: document.querySelector("#lobbyAvatarPreview1"),
  lobbyAvatarGrid0: document.querySelector("#lobbyAvatarGrid0"),
  newGameBtn: document.querySelector("#newGameBtn"),
  rulesBtn: document.querySelector("#rulesBtn"),
  choiceDialog: document.querySelector("#choiceDialog"),
  choiceTitle: document.querySelector("#choiceTitle"),
  choiceText: document.querySelector("#choiceText"),
  choiceCardPreview: document.querySelector("#choiceCardPreview"),
  choiceOptions: document.querySelector("#choiceOptions"),
  remoteMessage: document.querySelector("#remoteMessage"),
  remoteMessageTitle: document.querySelector("#remoteMessageTitle"),
  remoteMessageText: document.querySelector("#remoteMessageText"),
  cardInspectDialog: document.querySelector("#cardInspectDialog"),
  cardInspectContent: document.querySelector("#cardInspectContent"),
  cardInspectClose: document.querySelector("#cardInspectClose"),
  discardBackdrop: document.querySelector("#discardBackdrop"),
  discardDialog: document.querySelector("#discardDialog"),
  discardDialogTitle: document.querySelector("#discardDialogTitle"),
  discardDialogCards: document.querySelector("#discardDialogCards"),
  discardDialogClose: document.querySelector("#discardDialogClose"),
  gameOverDialog: document.querySelector("#gameOverDialog"),
  gameOverBanner: document.querySelector("#gameOverBanner"),
  gameOverTitle: document.querySelector("#gameOverTitle"),
  gameOverText: document.querySelector("#gameOverText"),
  gameOverLobby: document.querySelector("#gameOverLobby"),
  gameOverNewGame: document.querySelector("#gameOverNewGame"),
  gameSettingsButton: document.querySelector("#gameSettingsButton"),
  gameSettingsOverlay: document.querySelector("#gameSettingsOverlay"),
  gameSettingsCloseButton: document.querySelector("#gameSettingsCloseButton"),
  gameSettingsNewGameButton: document.querySelector("#gameSettingsNewGameButton"),
  gameSettingsLobbyButton: document.querySelector("#gameSettingsLobbyButton"),
  gameSfxVolumeSlider: document.querySelector("#gameSfxVolumeSlider"),
  gameSfxVolumeValue: document.querySelector("#gameSfxVolumeValue"),
  gameConfirmOverlay: document.querySelector("#gameConfirmOverlay"),
  gameConfirmTitle: document.querySelector("#gameConfirmTitle"),
  gameConfirmText: document.querySelector("#gameConfirmText"),
  gameConfirmCancelButton: document.querySelector("#gameConfirmCancelButton"),
  gameConfirmAcceptButton: document.querySelector("#gameConfirmAcceptButton"),
  debugPanel: document.querySelector("#debugPanel"),
  debugAnimationMode: document.querySelector("#debugAnimationMode"),
  debugCardSearch: document.querySelector("#debugCardSearch"),
  debugCardSuggestions: document.querySelector("#debugCardSuggestions"),
  debugAddNamedP1: document.querySelector("#debugAddNamedP1"),
  debugAddNamedP2: document.querySelector("#debugAddNamedP2"),
  debugAddP1: document.querySelector("#debugAddP1"),
  debugAddP2: document.querySelector("#debugAddP2"),
  debugDrawP1: document.querySelector("#debugDrawP1"),
  debugDrawP2: document.querySelector("#debugDrawP2"),
  debugPlayerAttack: document.querySelector("#debugPlayerAttack"),
  debugBotAttack: document.querySelector("#debugBotAttack"),
  rulesDialog: document.querySelector("#rulesDialog")
};

let state;
let gameAssetsPreloadPromise = null;
let gameAssetsPreloaded = false;
const retainedPreloadedImages = new Map();
let idCounter = 1;
let choiceDepth = 0;
let remoteMessageTimer = 0;
let remoteMessageKind = "";
let opponentAbilityMessage = null;
let blockPrompt = null;
let blockSelection = null;
let discardSelection = null;
let discardPileSelection = null;
let defeatSelection = null;
let disableBlockSelection = null;
let stealSelection = null;
let hunterAttackPrompt = null;
let hunterTargetSelection = null;
let frenzySecondAttackPrompt = null;
let receivedCardChoicePrompt = null;
let hyenixChoicePrompt = null;
let drOrangeChoicePrompt = null;
let earwigChoicePrompt = null;
let utilityKeywordSelection = null;
let pendingMindbug = null;
let choicePromptActorIndex = null;
let activeChoicePromptContext = null;
let activeChoicePromptResolve = null;
let activeChoicePreviousPhase = null;
let inspectAnimation = null;
let suppressNextInspectClick = false;
let handScrubGesture = null;
let inspectedLocalHandCardId = "";
let inspectedLocalBoardCardId = "";
let inspectedDiscardPileCardId = "";
let receivedCardOverlay = null;
const hiddenReceivedHandCardIds = new Set();
let debugOpen = false;
let animationTestMode = false;
let pointerPosition = null;
let debugTargetCardRect = null;
let debugAddCardIndex = 0;
let debugRandomAttackPlan = null;
let lastTurnPointerActive = null;
let opponentHandSlotOffset = 0;
let lobbyStarted = false;
let lobbyMode = "solo";
let lobbyScreen = "profile";
let lobbyProfileReturnScreen = "mode";
let localPlayerName = "Bạn";
let lobbyProfileReady = false;
let botDifficulty = "normal";
let lobbyRoom = null;
let lobbyDuelStatus = "";
let duelSocket = null;
let duelClientId = loadOrCreateDuelSessionId();
let duelModeActive = false;
let applyingRemoteDuelState = false;
let duelBlockSelectionMode = false;
let duelHunterTargetSelectionMode = false;
let duelUpdateQueue = Promise.resolve();
let lastDuelDrawFxDiffKey = "";
let pendingGameConfirmAction = null;
let lastGameOverSoundWinner = null;
let pendingFrostyDrawToFivePlayerIndex = null;
const playerAvatars = [1, randomAvatarId()];
const playerColorRoles = ["red", "blue"];
const PLAYER_COLOR_CONFIG = {
  red: {
    ring: "#b84438",
    fill: "rgba(184, 68, 56, .5)",
    avatarBg: "rgba(82, 27, 24, .84)",
    border: "#ffd2cc"
  },
  blue: {
    ring: "#357aa7",
    fill: "rgba(53, 122, 167, .5)",
    avatarBg: "rgba(22, 48, 78, .84)",
    border: "#cfe6ff"
  }
};

function loadOrCreateDuelSessionId() {
  try {
    const saved = window.localStorage?.getItem("mindbug.duelSessionId");
    if (saved) return saved;
    const created = window.crypto?.randomUUID?.() ?? `p-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage?.setItem("mindbug.duelSessionId", created);
    return created;
  } catch {
    return `p-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function savedDuelRoomCode() {
  try {
    return window.localStorage?.getItem("mindbug.activeDuelRoom") ?? "";
  } catch {
    return "";
  }
}

function saveDuelRoomCode(code = "") {
  try {
    if (code) window.localStorage?.setItem("mindbug.activeDuelRoom", code);
    else window.localStorage?.removeItem("mindbug.activeDuelRoom");
  } catch {
    // Reconnect remains available for the lifetime of this page.
  }
}

async function hydrateBotLearningFromFile() {
  try {
    const fileUrl = new URL(`${import.meta.env.BASE_URL}bot-learning-data.json`, window.location.href);
    const response = await fetch(fileUrl, { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    const fileGames = Array.isArray(payload?.games) ? payload.games.slice(-100) : [];
    const fileMemory = payload?.strategyMemory;
    if (!fileMemory || typeof fileMemory !== "object" || typeof fileMemory.entries !== "object") return;
    const localGamesRaw = window.localStorage?.getItem("mindbug.botLearningGames.v1");
    const localMemoryRaw = window.localStorage?.getItem("mindbug.botStrategyMemory.1");
    const localGames = localGamesRaw ? JSON.parse(localGamesRaw) : [];
    const localMemory = localMemoryRaw ? JSON.parse(localMemoryRaw) : null;
    const fileCount = Number(fileMemory.completedGames ?? fileGames.length);
    const localCount = Number(localMemory?.completedGames ?? (Array.isArray(localGames) ? localGames.length : 0));
    if (fileCount > localCount) {
      window.localStorage?.setItem("mindbug.botLearningGames.v1", JSON.stringify(fileGames));
      window.localStorage?.setItem("mindbug.botStrategyMemory.1", JSON.stringify(fileMemory));
    } else if (localCount > fileCount) {
      await persistBotLearningFile();
    }
  } catch {
    // The bundled learning file is optional; localStorage remains the fallback.
  }
}

async function persistBotLearningFile() {
  try {
    const gamesRaw = window.localStorage?.getItem("mindbug.botLearningGames.v1");
    const memoryRaw = window.localStorage?.getItem("mindbug.botStrategyMemory.1");
    const games = gamesRaw ? JSON.parse(gamesRaw) : [];
    const strategyMemory = memoryRaw ? JSON.parse(memoryRaw) : null;
    if (!strategyMemory || !Array.isArray(games)) return;
    const socketOrigin = String(import.meta.env.VITE_SOCKET_URL || "").trim();
    const apiUrl = new URL("/api/bot-learning", socketOrigin || window.location.origin);
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ games: games.slice(-100), strategyMemory })
    });
    if (!response.ok) throw new Error(`Learning sync failed: ${response.status}`);
  } catch {
    // Static hosting cannot write files; the browser copy remains available.
  }
}
const DEBUG_KEYWORD_CARD_NAMES = {
  FRENZY: "Luchataur",
  HUNTER: "Compost Dragon",
  POISONOUS: "Deathweaver",
  SNEAKY: "Ferret Bomber",
  TOUGH: "Elephantopus"
};
const CARD_ANIMATION_STATE = {
  IDLE: "idle",
  ATTACK_INTENT: "attackIntent",
  INSPECT_OPENING: "inspectOpening",
  INSPECT_OPEN: "inspectOpen",
  INSPECT_CLOSING: "inspectClosing",
  HAND_REFLOW: "handReflow",
  MINDBUG_PENDING: "mindbugPending",
  ATTACK_RESOLVE_FACE: "attackResolveFace",
  ATTACK_RESOLVE_CREATURE: "attackResolveCreature",
  BOARD_EXIT: "boardExit",
  DAMAGED: "damaged",
  DEFEATED: "defeated",
  EVOLVING: "evolving"
};
const cardAnimationStates = new Map();
const handLayoutCache = new Map();
const handLayoutVersions = new Map();
const suppressedBoardEnterCardIds = new Set();
const hiddenMindbugTravelCardIds = new Set();
const hiddenBoardExitCardIds = new Set();
const hiddenEvolutionCardIds = new Set();
const waterdropActionFxPlayedCardIds = new Set();
const activeDimmedCardIds = new Set();
const enteringDimmedCardIds = new Set();
const fadingDimmedCardIds = new Set();
let deckDrawFxId = 1;
let deckDrawFxItems = [];
let dimFadeTimer = 0;
const BOT_INDEX = 1;
let bot = createMindbugBot(BOT_INDEX);

function configureBotDifficulty() {
  const config = {
    easy: { searchLimitMs: 250, searchDepth: 2, branchLimit: 4, mindbugDepth: 2 },
    normal: { searchLimitMs: 900, searchDepth: 4, branchLimit: 7, mindbugDepth: 3 },
    hard: { searchLimitMs: 1800, searchDepth: 5, branchLimit: 10, mindbugDepth: 4 }
  }[botDifficulty] ?? {};
  bot = createMindbugBot(BOT_INDEX, { delay: 1150, afterActionDelay: 900, ...config });
}

function syncAppScale() {
  if (viewportScaleLockedForKeyboard) {
    window.requestAnimationFrame(() => syncOpponentPendingAbilityPointer());
    return;
  }
  const viewport = window.visualViewport;
  const viewportWidth = viewport?.width ?? window.innerWidth;
  const viewportHeight = viewport?.height ?? window.innerHeight;
  const scale = Math.min(1, viewportWidth / APP_DESIGN_WIDTH, viewportHeight / APP_DESIGN_HEIGHT);
  document.documentElement.style.setProperty("--app-scale", scale.toFixed(4));
  window.requestAnimationFrame(() => syncOpponentPendingAbilityPointer());
}
const animations = new GameAnimations();

async function loadVietnameseCardText() {
  try {
    const files = [
      new URL("../card-list.vi.md", import.meta.url),
      new URL("../expansion_1-card-list.vi.md", import.meta.url),
      new URL("../beyond-evolution-card-list.vi.md", import.meta.url)
    ];
    for (const file of files) {
      const response = await fetch(file, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Không tải được ${file.pathname} (${response.status})`);
      }
      const text = await response.text();
      const parsed = parseVietnameseCardMarkdown(text);
      Object.assign(CARD_NAME_LABELS, parsed.names);
      Object.assign(ABILITY_LABELS, parsed.abilities);
    }
  } catch (error) {
    console.warn("Dùng bản dịch mặc định trong JS vì không đọc được file dịch bài.", error);
  }
}

function parseVietnameseCardMarkdown(text) {
  const names = {};
  const abilities = {};
  let sourceName = "";

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      sourceName = heading[1].trim();
      continue;
    }
    if (!sourceName) continue;

    const displayName = line.match(/^-\s*Tên:\s*(.+)$/i);
    if (displayName) {
      names[sourceName] = displayName[1].trim();
      continue;
    }

    const ability = line.match(/^-\s*Hiệu ứng:\s*(.+)$/i);
    if (ability) abilities[sourceName] = ability[1].trim();
  }

  return { names, abilities };
}

function makeCard([name, count, power, keywords, ability]) {
  const evolutionInfo = EVOLUTION_INFO[name] ?? { level: 0, evolution: "", root: "" };
  return {
    id: `c${idCounter++}`,
    name,
    basePower: power,
    keywords,
    ability,
    level: evolutionInfo.level,
    evolution: evolutionInfo.evolution,
    evolutionRoot: evolutionInfo.root,
    evolutionChainId: "",
    evolvedFromNames: [],
    highestEvolutionName: name,
    exhausted: false,
    attacksThisTurn: 0,
    damage: 0,
    originalOwnerIndex: null,
    mindbuggedThisTurn: false,
    cannotBlockThisTurn: false,
    lurkerSneakyThisTurn: false
    ,cannotBeDefeatedThisTurn: false
    ,countLifeLossAfterAttack: false
    ,deferredAttackLifeEffect: ""
  };
}

function makeDeck() {
  const deckSpecs = [
    ...RAW_CARDS.filter(([name]) => !EVOLUTION_INFO[name]),
    ...BEYOND_EVOLUTION_CARDS
  ];
  const cards = [];
  for (const spec of deckSpecs) {
    for (let i = 0; i < spec[1]; i += 1) cards.push(makeCard(spec));
  }
  let filler = 0;
  while (cards.length < TARGET_DECK_SIZE) {
    const spec = deckSpecs[filler % deckSpecs.length];
    cards.push(makeCard(spec));
    filler += 1;
  }
  return shuffle(cards);
}

function makeExtraDeck() {
  return EXTRA_CARD_SPECS.map(spec => makeCard(spec));
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function normalizeAvatarId(avatarId, fallback = 1) {
  const id = Number.parseInt(avatarId, 10);
  if (Number.isInteger(id) && id >= 1 && id <= 16) return id;
  return fallback;
}

function avatarUrl(avatarId) {
  return new URL(`assets/avatars/${normalizeAvatarId(avatarId)}.png`, APP_ROOT_URL).href;
}

function randomAvatarId(excludeId = 0) {
  const choices = Array.from({ length: 16 }, (_, index) => index + 1).filter(id => id !== excludeId);
  return choices[Math.floor(Math.random() * choices.length)] ?? 1;
}

function sanitizePlayerName(name) {
  return String(name || "").trim().slice(0, 8) || "Bạn";
}

function loadLobbyProfile() {
  try {
    const savedName = window.localStorage?.getItem("mindbug.playerName");
    const savedAvatar = Number.parseInt(window.localStorage?.getItem("mindbug.playerAvatar") ?? "", 10);
    const savedReady = window.localStorage?.getItem("mindbug.profileReady") === "1";
    const savedDifficulty = window.localStorage?.getItem("mindbug.botDifficulty");
    localPlayerName = sanitizePlayerName(savedName);
    lobbyProfileReady = savedReady || Boolean(savedName) || Number.isInteger(savedAvatar);
    if (["easy", "normal", "hard"].includes(savedDifficulty ?? "")) {
      botDifficulty = savedDifficulty;
    }
    if (Number.isInteger(savedAvatar) && savedAvatar >= 1 && savedAvatar <= 16) {
      playerAvatars[0] = savedAvatar;
    }
  } catch {
    localPlayerName = "Bạn";
    lobbyProfileReady = false;
  }
}

function saveLobbyProfile() {
  try {
    window.localStorage?.setItem("mindbug.playerName", sanitizePlayerName(localPlayerName));
    window.localStorage?.setItem("mindbug.playerAvatar", String(playerAvatars[0]));
    window.localStorage?.setItem("mindbug.profileReady", "1");
    window.localStorage?.setItem("mindbug.botDifficulty", botDifficulty);
    lobbyProfileReady = true;
  } catch {
    // localStorage can be unavailable in private contexts; the game can continue without persistence.
    lobbyProfileReady = true;
  }
}

function renderLobby() {
  loadLobbyProfile();
  configureBotDifficulty();
  if (!lobbyProfileReady) lobbyScreen = "profile";
  else if (lobbyScreen === "profile") lobbyScreen = "mode";
  playerAvatars[1] = randomAvatarId(playerAvatars[0]);
  if (els.lobbyPlayerName) els.lobbyPlayerName.value = localPlayerName;
  renderLobbyAvatarGrid(0);
  renderLobbyHeroCards();
  updateLobbyScreen();
  updateLobbyDifficultyControls();
  updateLobbyAvatarPreviews();
  updateLobbyProfileChip();
  els.lobbyView?.classList.toggle("hidden", lobbyStarted);
  document.body.classList.toggle("lobbyOpen", !lobbyStarted);
  if (!lobbyStarted) {
    hideGameSettings();
    hideGameConfirm();
  }
}

function renderLobbyHeroCards() {
  if (!els.lobbyHeroCards || els.lobbyHeroCards.childElementCount) return;
  const cardNames = shuffle(ALL_CARD_SPECS.map(card => card[0]))
    .filter(name => !EVOLUTION_INFO[name])
    .filter(name => cardSpriteSrc(name))
    .slice(0, 3);
  els.lobbyHeroCards.innerHTML = cardNames.map(name => (
    `<img class="lobbyHeroCard" src="${cardSpriteSrc(name)}" alt="">`
  )).join("");
}

function renderLobbyAvatarGrid(playerIndex) {
  const grid = playerIndex === 0 ? els.lobbyAvatarGrid0 : null;
  if (!grid) return;
  grid.innerHTML = "";
  for (let avatarId = 1; avatarId <= 16; avatarId += 1) {
    const button = document.createElement("button");
    button.className = `lobbyAvatarButton ${playerAvatars[0] === avatarId ? "selected" : ""}`;
    button.type = "button";
    button.dataset.avatarId = String(avatarId);
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", playerAvatars[0] === avatarId ? "true" : "false");
    button.setAttribute("aria-label", `Avatar ${avatarId}`);
    button.innerHTML = `<img src="${avatarUrl(avatarId)}" alt="">`;
    button.addEventListener("click", () => {
      playerAvatars[0] = avatarId;
      if (playerAvatars[1] === avatarId) playerAvatars[1] = randomAvatarId(avatarId);
      if (lobbyProfileReady) saveLobbyProfile();
      emitDuelProfileUpdate();
      renderLobbyAvatarGrid(0);
      updateLobbyAvatarPreviews();
      renderScoreboardSafe();
    });
    grid.append(button);
  }
}

function updateLobbyAvatarPreviews() {
  if (els.lobbyAvatarPreview0) els.lobbyAvatarPreview0.src = avatarUrl(playerAvatars[0]);
  if (els.lobbyAvatarPreview1) els.lobbyAvatarPreview1.src = avatarUrl(playerAvatars[1]);
  updateLobbyProfileChip();
}

function updateLobbyProfileChip() {
  if (els.lobbyProfileChipAvatar) els.lobbyProfileChipAvatar.src = avatarUrl(playerAvatars[0]);
  if (els.lobbyProfileChipName) els.lobbyProfileChipName.textContent = sanitizePlayerName(localPlayerName);
}

function updateLobbyScreen() {
  const isProfile = lobbyScreen === "profile";
  const visibleScreen = isProfile ? lobbyProfileReturnScreen : lobbyScreen;
  const isMode = visibleScreen === "mode";
  const isSetup = visibleScreen === "solo";
  const isDuel = visibleScreen === "duel";
  const isWaiting = visibleScreen === "waiting";
  els.lobbyView?.classList.toggle("profileOpen", isProfile);
  if (els.lobbyProfileView) els.lobbyProfileView.hidden = !isProfile;
  if (els.lobbyModeView) els.lobbyModeView.hidden = !isMode;
  if (els.lobbySetupView) els.lobbySetupView.hidden = !isSetup;
  if (els.lobbyDuelView) els.lobbyDuelView.hidden = !isDuel;
  if (els.lobbyWaitingView) els.lobbyWaitingView.hidden = !isWaiting;
  if (els.lobbyTitle) {
    els.lobbyTitle.textContent = isSetup
      ? "Solo"
      : isDuel
        ? "Duel"
        : isWaiting
          ? "Phòng chờ"
          : "Cướp Rau Quả";
  }
  if (els.lobbySubtitle) {
    els.lobbySubtitle.hidden = !isMode;
    els.lobbySubtitle.textContent = "Chọn chế độ";
  }
  if (els.lobbyStartButton) els.lobbyStartButton.disabled = lobbyMode !== "solo";
  renderLobbyWaitingRoom();
}

function updateLobbyDifficultyControls() {
  document.querySelectorAll("[data-bot-difficulty]").forEach(button => {
    const active = button.dataset.botDifficulty === botDifficulty;
    button.classList.toggle("active", active);
    button.setAttribute("aria-checked", active ? "true" : "false");
  });
}

function setLobbyMode(mode) {
  lobbyMode = mode === "duel" ? "duel" : "solo";
  lobbyScreen = lobbyMode === "duel" ? "duel" : "solo";
  updateLobbyScreen();
}

function showLobbyModes() {
  lobbyScreen = "mode";
  lobbyRoom = null;
  resetPlayerColorRoles();
  updateLobbyScreen();
}

function finishLobbyProfile() {
  localPlayerName = sanitizePlayerName(els.lobbyPlayerName?.value ?? localPlayerName);
  if (els.lobbyPlayerName) els.lobbyPlayerName.value = localPlayerName;
  saveLobbyProfile();
  updateLobbyProfileChip();
  emitDuelProfileUpdate();
  lobbyScreen = lobbyProfileReturnScreen || "mode";
  updateLobbyScreen();
}

function showProfileOverlay() {
  if (!lobbyStarted) {
    lobbyProfileReturnScreen = lobbyScreen === "profile" ? lobbyProfileReturnScreen : lobbyScreen;
    if (!lobbyProfileReturnScreen || lobbyProfileReturnScreen === "profile") lobbyProfileReturnScreen = "mode";
    lobbyScreen = "profile";
    if (els.lobbyPlayerName) els.lobbyPlayerName.value = localPlayerName;
    if (els.lobbyPlayerName) els.lobbyPlayerName.placeholder = "Tên tối đa 8 ký tự";
    updateLobbyScreen();
  }
}

function hideProfileOverlay() {
  if (els.lobbyPlayerName) {
    els.lobbyPlayerName.value = localPlayerName;
    els.lobbyPlayerName.placeholder = "Tên tối đa 8 ký tự";
  }
  lobbyScreen = lobbyProfileReturnScreen || "mode";
  updateLobbyScreen();
}

function prepareProfileNameInput() {
  if (!els.lobbyPlayerName) return;
  els.lobbyPlayerName.value = "";
  els.lobbyPlayerName.placeholder = "";
}

function restoreProfileNamePlaceholder() {
  if (!els.lobbyPlayerName || els.lobbyPlayerName.value.trim()) return;
  els.lobbyPlayerName.placeholder = "Tên tối đa 8 ký tự";
}

function setBotDifficulty(difficulty) {
  if (!["easy", "normal", "hard"].includes(difficulty)) return;
  botDifficulty = difficulty;
  saveLobbyProfile();
  configureBotDifficulty();
  updateLobbyDifficultyControls();
}

function duelProfilePayload() {
  return {
    name: sanitizePlayerName(localPlayerName),
    avatar: playerAvatars[0],
    sessionId: duelClientId
  };
}

function resetPlayerColorRoles() {
  playerColorRoles[0] = "red";
  playerColorRoles[1] = "blue";
}

function setDuelPlayerColorRoles(room, localIndex) {
  const players = Array.isArray(room?.players) ? room.players : [];
  const opponentIndex = localIndex === 0 ? 1 : 0;
  const localPlayer = players[localIndex];
  const opponentPlayer = players[opponentIndex];
  playerColorRoles[0] = localPlayer?.id === room?.hostId ? "red" : "blue";
  playerColorRoles[1] = opponentPlayer?.id === room?.hostId ? "red" : "blue";
}

function playerColorConfig(playerIndex) {
  return PLAYER_COLOR_CONFIG[playerColorRoles[playerIndex]] ?? PLAYER_COLOR_CONFIG.red;
}

function setLobbyDuelStatus(message = "") {
  lobbyDuelStatus = message;
  if (els.lobbyDuelNote) {
    els.lobbyDuelNote.textContent = lobbyDuelStatus || "Tạo hoặc tham gia phòng online.";
  }
  if (els.lobbyWaitingText && lobbyRoom?.online && message) {
    els.lobbyWaitingText.textContent = message;
  }
}

function updateJoinRoomButtonState() {
  const code = String(els.lobbyRoomCodeInput?.value || "").replace(/\D/g, "").slice(0, 4);
  els.lobbyJoinRoomButton?.classList.toggle("lobbyJoinReady", code.length === 4);
}

function ensureDuelSocket() {
  if (duelSocket) return duelSocket;
  const socketUrl = String(import.meta.env.VITE_SOCKET_URL || "").trim();
  duelSocket = io(socketUrl || undefined, {
    autoConnect: false,
    transports: ["websocket", "polling"]
  });
  duelSocket.on("connect", () => {
    setLobbyDuelStatus("");
    const roomCode = lobbyRoom?.code || savedDuelRoomCode();
    if (roomCode) {
      duelSocket.emit("resume-session", { sessionId: duelClientId, roomCode }, response => {
        if (response?.ok) {
          applyDuelRoom(response.room);
          saveDuelRoomCode(response.room.code);
          if (response.state) {
            if (duelModeActive) {
              queueAuthoritativeDuelUpdate({
                room: response.room,
                state: response.state,
                event: { type: "resume" }
              });
            } else {
              startDuelMatch(response.room, 0, response.state);
            }
          }
          return;
        }
        if (response?.reason === "taken-over") {
          saveDuelRoomCode("");
          showRemoteMessage("Bạn đã thoát game", "");
          returnToLobby();
          return;
        }
        if (response?.reason === "not-found") {
          saveDuelRoomCode("");
          setLobbyDuelStatus("Phòng trước đó không còn tồn tại.");
        }
      });
    }
  });
  duelSocket.on("connect_error", () => {
    setLobbyDuelStatus("Không kết nối được phòng online.");
  });
  duelSocket.on("room-update", room => {
    applyDuelRoom(room);
  });
  duelSocket.on("room-start", payload => {
    applyDuelRoom(payload.room);
    startDuelMatch(payload.room, payload.seed, payload.state);
  });
  duelSocket.on("game-update", payload => {
    queueAuthoritativeDuelUpdate(payload);
  });
  duelSocket.on("opponent-returned", payload => {
    if (els.choiceDialog?.open && activeChoicePromptContext?.type === "opponent-away") {
      finishActiveChoicePrompt("returned");
    }
    showRemoteMessage(`${payload?.playerName || "Đối thủ"} đã quay lại`, "");
  });
  duelSocket.on("opponent-away-timeout", payload => {
    if (duelModeActive) showOpponentAwayPrompt(payload);
    else window.setTimeout(() => showOpponentAwayPrompt(payload), 800);
  });
  duelSocket.on("bot-takeover", payload => {
    continueDuelWithBot(payload);
  });
  return duelSocket;
}

async function showOpponentAwayPrompt(payload = {}) {
  if (!duelModeActive || els.choiceDialog?.open) return;
  const choice = await askChoice({
    title: `${payload.playerName || "Đối thủ"} đã thoát game`,
    text: "Có muốn chờ tiếp không?",
    options: [
      { label: "Chờ", value: "wait" },
      { label: "Chơi tiếp với Bot", value: "bot" },
      { label: "Về sảnh", value: "lobby" }
    ],
    context: { type: "opponent-away", preservePhase: true }
  });
  if (choice === "returned") return;
  duelSocket?.emit("disconnect-choice", {
    choice,
    playerSessionId: payload.playerSessionId
  }, response => {
    if (!response?.ok) showRemoteMessage("Không thể thực hiện", response?.message || "");
    if (choice === "lobby" && response?.ok) returnToLobby();
  });
}

function continueDuelWithBot(payload = {}) {
  const room = payload.room;
  const localizedState = localizeServerState(payload.state, room);
  if (!localizedState) return;
  state = localizedState;
  duelModeActive = false;
  saveDuelRoomCode("");
  lobbyRoom = null;
  configureBotDifficulty();
  bot.startLearningGame();
  state.players[BOT_INDEX].name = "Bot";
  playerAvatars[BOT_INDEX] = randomAvatarId(playerAvatars[0]);
  clearRemoteMessage();
  if (state.phase === "pending") {
    state.phase = "action";
    state.pending = null;
  }
  render();
  scheduleBotTurn();
}

function connectDuelSocket() {
  const socket = ensureDuelSocket();
  if (socket.connected) return Promise.resolve(socket);
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleError);
    };
    const handleConnect = () => {
      cleanup();
      resolve(socket);
    };
    const handleError = error => {
      cleanup();
      reject(error);
    };
    socket.once("connect", handleConnect);
    socket.once("connect_error", handleError);
    socket.connect();
  });
}

function emitDuelProfileUpdate() {
  if (!lobbyRoom?.online || !duelSocket?.connected) return;
  duelSocket.emit("profile-update", duelProfilePayload());
}

function cloneForNetwork(value) {
  return JSON.parse(JSON.stringify(value));
}

function swapPlayerIndex(index) {
  return index === 0 ? 1 : index === 1 ? 0 : index;
}

function mirrorCardOwner(card) {
  if (!card || typeof card !== "object") return card;
  if (Number.isInteger(card.originalOwnerIndex)) {
    card.originalOwnerIndex = swapPlayerIndex(card.originalOwnerIndex);
  }
  return card;
}

function mirrorCards(cards) {
  if (!Array.isArray(cards)) return;
  for (const card of cards) mirrorCardOwner(card);
}

function mirrorPlayer(player) {
  if (!player) return player;
  mirrorCards(player.deck);
  mirrorCards(player.hand);
  mirrorCards(player.board);
  mirrorCards(player.discard);
  return player;
}

function mirrorIncomingState(remoteState) {
  const mirrored = cloneForNetwork(remoteState);
  if (!Array.isArray(mirrored.players) || mirrored.players.length < 2) return null;
  mirrored.players = [mirrorPlayer(mirrored.players[1]), mirrorPlayer(mirrored.players[0])];
  mirrored.active = swapPlayerIndex(mirrored.active);
  mirrored.winner = mirrored.winner === null || mirrored.winner === undefined
    ? mirrored.winner
    : swapPlayerIndex(mirrored.winner);
  return mirrored;
}

function clearTransientChoicesForRemoteState() {
  blockSelection = null;
  blockPrompt = null;
  discardSelection = null;
  discardPileSelection = null;
  defeatSelection = null;
  disableBlockSelection = null;
  stealSelection = null;
  hunterAttackPrompt = null;
  hunterTargetSelection = null;
  frenzySecondAttackPrompt = null;
  receivedCardChoicePrompt = null;
  hyenixChoicePrompt = null;
  drOrangeChoicePrompt = null;
  earwigChoicePrompt = null;
  utilityKeywordSelection = null;
  pendingMindbug = null;
  choicePromptActorIndex = null;
  duelBlockSelectionMode = false;
  duelHunterTargetSelectionMode = false;
  inspectedLocalHandCardId = "";
  inspectedLocalBoardCardId = "";
  inspectedDiscardPileCardId = "";
  choiceDepth = 0;
  if (els.choiceDialog?.open) els.choiceDialog.close();
  if (els.cardInspectDialog?.open) els.cardInspectDialog.close();
}

function broadcastDuelState(reason = "action") {
  // Duel is server-authoritative; this legacy hook is kept for older local call sites.
}

function sendDuelAction(action) {
  if (!duelModeActive || !duelSocket?.connected) return;
  if (action?.type !== "new-game") clearRemoteMessageForAction();
  playActionSound(action);
  duelSocket.emit("duel-action", action, response => {
    if (!response?.ok) {
      showRemoteMessage("Không hợp lệ", response?.message || "");
    }
  });
}

function playActionSound(action) {
  if (!action?.type) return;
  if (action.type === "play-card") playSoundEffect("playCard");
  else if (action.type === "attack") playSoundEffect("attack");
  else if (action.type === "action-card") return;
  else if (action.type === "mindbug-choice") playSoundEffect(action.value === "steal" ? "mindbug" : "select");
  else if (action.type !== "new-game") playSoundEffect("select");
}

async function requestNewGame() {
  await ensureGameAssetsPreloaded({ showLobbyStatus: isLobbyVisible() });
  if (duelModeActive && lobbyRoom?.online && duelSocket?.connected) {
    closeGameOverDialog();
    hideGameSettings();
    hideGameConfirm();
    closeInspectDialogInstant();
    closeDiscardDialog({ force: true });
    sendDuelAction({ type: "new-game" });
    return;
  }
  newGame();
}

async function requestSurrender() {
  if (hasWinner() || els.choiceDialog?.open) return;
  const choice = await askChoice({
    title: "",
    text: "Đầu hàng?",
    options: [
      { label: "Chấp nhận", value: "yes" },
      { label: "Không", value: "no" }
    ],
    context: { type: "surrender", actorIndex: 0 }
  });
  if (choice !== "yes" || hasWinner()) return;
  if (duelModeActive && lobbyRoom?.online && duelSocket?.connected) {
    sendDuelAction({ type: "surrender" });
    return;
  }
  finishGame(1, `${state.players[0].name} đã đầu hàng.`);
}

function applyRemoteDuelState(payload = {}) {
  if (!duelModeActive || !payload.state) return;
  const mirrored = mirrorIncomingState(payload.state);
  if (!mirrored) return;
  applyingRemoteDuelState = true;
  clearTransientChoicesForRemoteState();
  state = mirrored;
  if (Array.isArray(payload.avatars) && payload.avatars.length >= 2) {
    playerAvatars[0] = payload.avatars[1] ?? playerAvatars[0];
    playerAvatars[1] = payload.avatars[0] ?? playerAvatars[1];
  }
  if (Array.isArray(payload.colorRoles) && payload.colorRoles.length >= 2) {
    playerColorRoles[0] = payload.colorRoles[1] ?? playerColorRoles[0];
    playerColorRoles[1] = payload.colorRoles[0] ?? playerColorRoles[1];
  }
  clearCardAnimationState();
  handLayoutCache.clear();
  handLayoutVersions.clear();
  render();
  applyingRemoteDuelState = false;
}

function mirrorPending(pending) {
  if (!pending) return null;
  const mirrored = cloneForNetwork(pending);
  for (const key of ["actorIndex", "playedByIndex", "attackerIndex", "playerIndex", "ownerIndex", "sourceOwnerIndex", "toIndex"]) {
    if (Number.isInteger(mirrored[key])) mirrored[key] = swapPlayerIndex(mirrored[key]);
  }
  if (mirrored.after && typeof mirrored.after === "object") {
    for (const key of ["actorIndex", "playedByIndex"]) {
      if (Number.isInteger(mirrored.after[key])) mirrored.after[key] = swapPlayerIndex(mirrored.after[key]);
    }
  }
  if (mirrored.evolve && typeof mirrored.evolve === "object") {
    for (const key of ["actorIndex", "ownerIndex"]) {
      if (Number.isInteger(mirrored.evolve[key])) mirrored.evolve[key] = swapPlayerIndex(mirrored.evolve[key]);
    }
  }
  if (mirrored.ownerByCardId && typeof mirrored.ownerByCardId === "object") {
    for (const cardId of Object.keys(mirrored.ownerByCardId)) {
      if (Number.isInteger(mirrored.ownerByCardId[cardId])) {
        mirrored.ownerByCardId[cardId] = swapPlayerIndex(mirrored.ownerByCardId[cardId]);
      }
    }
  }
  return mirrored;
}

function localizeDuelEvent(event, room = null) {
  if (!event || typeof event !== "object") return null;
  const players = Array.isArray(room?.players) ? room.players : (lobbyRoom?.players ?? []);
  const localIndex = Math.max(0, players.findIndex(player => player.id === duelClientId));
  const localized = cloneForNetwork(event);
  if (localized.afterEvent && typeof localized.afterEvent === "object") {
    localized.afterEvent = localizeDuelEvent(event.afterEvent, room);
  }
  if (localIndex !== 1) return localized;
  for (const key of ["actorIndex", "defenderIndex", "playedByIndex", "pendingActorIndex", "playerIndex", "toIndex", "ownerIndex"]) {
    if (Number.isInteger(localized[key])) localized[key] = swapPlayerIndex(localized[key]);
  }
  if (localized.drawnToFive && typeof localized.drawnToFive === "object" && Number.isInteger(localized.drawnToFive.playerIndex)) {
    localized.drawnToFive.playerIndex = swapPlayerIndex(localized.drawnToFive.playerIndex);
  }
  if (localized.discardAll && typeof localized.discardAll === "object") {
    if (Number.isInteger(localized.discardAll.playerIndex)) localized.discardAll.playerIndex = swapPlayerIndex(localized.discardAll.playerIndex);
    mirrorCards(localized.discardAll.handCards);
    mirrorCards(localized.discardAll.deckCards);
  }
  if (Array.isArray(localized.blockerIds)) localized.blockerIds = [...localized.blockerIds];
  if (Array.isArray(localized.defeatedEffects)) {
    for (const effect of localized.defeatedEffects) {
      if (Number.isInteger(effect.ownerIndex)) effect.ownerIndex = swapPlayerIndex(effect.ownerIndex);
    }
  }
  if (localized.pending) localized.pending = mirrorPending(localized.pending);
  if (localized.card) mirrorCardOwner(localized.card);
  if (localized.fromCard) mirrorCardOwner(localized.fromCard);
  if (localized.toCard) mirrorCardOwner(localized.toCard);
  return localized;
}

function localizeServerState(serverState, room) {
  const players = Array.isArray(room?.players) ? room.players : (lobbyRoom?.players ?? []);
  const localIndex = Math.max(0, players.findIndex(player => player.id === duelClientId));
  const localized = cloneForNetwork(serverState);
  if (!Array.isArray(localized.players) || localized.players.length < 2) return null;
  if (localIndex === 1) {
    localized.players = [mirrorPlayer(localized.players[1]), mirrorPlayer(localized.players[0])];
    localized.active = swapPlayerIndex(localized.active);
    localized.winner = localized.winner === null || localized.winner === undefined
      ? localized.winner
      : swapPlayerIndex(localized.winner);
    localized.pending = mirrorPending(localized.pending);
  }
  return localized;
}

function queueAuthoritativeDuelUpdate(payload = {}) {
  duelUpdateQueue = duelUpdateQueue
    .catch(() => {})
    .then(() => handleAuthoritativeDuelUpdate(payload));
}

async function handleAuthoritativeDuelUpdate(payload = {}) {
  await ensureGameAssetsPreloaded({ showLobbyStatus: isLobbyVisible() });
  const localizedEvent = localizeDuelEvent(payload.event, payload.room);
  const nextState = localizeServerState(payload.state, payload.room);
  if (!nextState) return;
  if (!state || localizedEvent?.type === "start") {
    applyAuthoritativeDuelState(payload.state, payload.room, localizedEvent);
    playOpeningDealSounds();
    return;
  }
  try {
    await animateDuelEvent(localizedEvent, nextState);
  } catch (error) {
    console.warn("Không thể hoàn tất animation Duel; áp dụng state server để tránh kẹt ván.", error);
  }
  applyAuthoritativeDuelState(payload.state, payload.room, localizedEvent, { preserveTransient: true });
  playExplicitDiscardDrawFx(localizedEvent);
  if (localizedEvent?.type === "new-game") {
    playOpeningDealSounds();
  }
}

async function animateDuelEvent(event, nextState, options = {}) {
  if (!event?.type || hasWinner()) return;
  syncCardAttackStateFromNextState(event, nextState);
  const lethalLifeTransition = nextState?.winner !== null
    && nextState?.winner !== undefined
    && nextState.players?.some(player => Number(player?.life) <= 0);
  if (lethalLifeTransition) {
    await playDuelLifeDeltaFxFromStateDiff(state, nextState, { forceImpact: true });
    return;
  }
  const opponentAbilityCard = opponentAbilityCardFromEvent(event);
  if (opponentAbilityCard) setOpponentAbilityMessage(opponentAbilityCard);
  const deferredLifeDelta = shouldDeferDuelLifeDelta(event);
  if (!deferredLifeDelta) {
    await playDuelLifeDeltaFxFromStateDiff(state, nextState);
  }
  if (event.type !== "attack-face" && event.type !== "ability-hyenix-choice") await playHyenixReviveFxFromStateDiff(state, nextState);
  const explicitDiscardDraw = event.drawnToFive?.count > 0;
  if (!explicitDiscardDraw && !options.suppressDrawDiff) playDuelDrawFxFromStateDiff(state, nextState);
  if (event.ability === "utility-no-target") {
    showRemoteMessage("Không có mục tiêu", "Hiệu ứng của Utility Bug bị hủy.");
  }
  if (event.type === "play-card" && event.actorIndex === 1 && event.card) {
    playSoundEffect("playCard");
    await revealPlayedCardOverlay(event.card, 1, measureOpponentLeftmostHandCardRect());
    await animateDuelDefeatedIds(event.defeatedIds, event.defeatedEffects);
    return;
  }
  if (event.type === "ability-pending" && event.sourceCard) {
    playSoundEffect("ability");
    if (event.ability === "experiment-control" && event.controlCardId) {
      const sourceRect = measureBoardSlotRect(event.controlCardId);
      const moved = moveStateBoardCard(state, event.controlCardId, event.toIndex);
      if (moved && sourceRect) {
        suppressedBoardEnterCardIds.add(moved.id);
        hiddenMindbugTravelCardIds.add(moved.id);
        render();
        await animateMindbugSteal(moved, sourceRect, { sound: "ability" });
      }
    }
    if (event.ability === "action") {
      await playWaterdropActionFx(event.sourceCard.id);
      waterdropActionFxPlayedCardIds.add(event.sourceCard.id);
    }
    await animateDuelDefeatedIds(event.defeatedIds, event.defeatedEffects);
    showRemoteMessage(`${displayCardName(event.sourceCard)} kích hoạt hiệu ứng`, "");
    return;
  }
  if (event.type === "ability-cancel") {
    playSoundEffect("ability");
    if (event.sourceCard?.name === "Captain Hippo") {
      const captain = findCardById(event.sourceCard.id) ?? event.sourceCard;
      setOpponentAbilityMessage(captain, displayAbility(captain));
      showRemoteMessage("Không thể Tấn công", event.message || "Captain Hippo hủy đòn tấn công.");
    } else {
      showRemoteMessage("Không thể ép tấn công", event.message || "Hiệu ứng bị hủy.");
    }
    return;
  }
  if (event.type === "ability-dr-orange" && event.activate) {
    playSoundEffect("ability");
    const returnedOwnerIndex = 1 - event.actorIndex;
    for (const cardId of event.returnedIds ?? []) {
      await animateCardReturnToHand(cardId, returnedOwnerIndex);
      const board = state.players[returnedOwnerIndex]?.board ?? [];
      const index = board.findIndex(card => card.id === cardId);
      if (index >= 0) {
        const [returnedCard] = board.splice(index, 1);
        returnedCard.exhausted = false;
        returnedCard.attacksThisTurn = 0;
        returnedCard.damage = 0;
        returnedCard.originalOwnerIndex = returnedOwnerIndex;
        state.players[returnedOwnerIndex].hand.push(returnedCard);
        if (returnedOwnerIndex === BOT_INDEX) opponentHandSlotOffset += 1;
        render();
        await afterNextPaint();
      }
    }
    if (event.afterEvent) await animateDuelEvent(event.afterEvent, nextState, { suppressDrawDiff: explicitDiscardDraw });
    return;
  }
  if (event.type === "ability-experiment-exchange") {
    playSoundEffect("ability");
    const experimentRect = measureBoardSlotRect(event.experimentId);
    const targetRect = measureBoardSlotRect(event.targetId);
    const experiment = moveStateBoardCard(state, event.experimentId, event.enemyIndex);
    const target = moveStateBoardCard(state, event.targetId, event.ownerIndex);
    if (experiment && target) {
      for (const moved of [experiment, target]) {
        moved.exhausted = true;
        suppressedBoardEnterCardIds.add(moved.id);
        hiddenMindbugTravelCardIds.add(moved.id);
      }
      render();
      await Promise.all([
        animateMindbugSteal(experiment, experimentRect, { sound: "ability" }),
        animateMindbugSteal(target, targetRect, { sound: "ability" })
      ]);
    }
    if (event.afterEvent) await animateDuelEvent(event.afterEvent, nextState, { suppressDrawDiff: explicitDiscardDraw });
    return;
  }
  if (event.type?.startsWith("ability-")) {
    playSoundEffect("ability");
    await animateDuelDefeatedIds(event.defeatedIds, event.defeatedEffects);
    if (event.afterEvent) await animateDuelEvent(event.afterEvent, nextState, { suppressDrawDiff: explicitDiscardDraw });
    return;
  }
  if (event.type !== "attack-creature" && Array.isArray(event.defeatedIds) && event.defeatedIds.length) {
    await animateDuelDefeatedIds(event.defeatedIds, event.defeatedEffects);
  }
  if (event.type === "action-evolve") {
    playSoundEffect("ability");
    const ownerIndex = Number.isInteger(event.ownerIndex) ? event.ownerIndex : event.actorIndex;
    const fromCard = findCardById(event.fromCardId) ?? event.fromCard;
    if (fromCard && event.toCard) {
      suppressedBoardEnterCardIds.add(event.toCard.id);
      if (waterdropActionFxPlayedCardIds.has(fromCard.id)) {
        waterdropActionFxPlayedCardIds.delete(fromCard.id);
      } else {
        await playWaterdropActionFx(fromCard.id);
      }
      await playDuelLifeDeltaFxFromStateDiff(state, nextState);
      await animateEvolutionFlip(fromCard, event.toCard, ownerIndex);
    }
    return;
  }
  if (event.type === "mindbug-steal") {
    const sourceRect = measureBoardSlotRect(event.cardId);
    if (
      (event.card?.name === "Radioactive Rabbit" && event.ability === "control")
      || (event.card?.name === "The Experiment" && event.ability === "experiment-control")
    ) {
      const stolenState = cloneForNetwork(nextState);
      const stolenCard = moveStateBoardCard(stolenState, event.cardId, event.actorIndex);
      if (stolenCard) {
        suppressedBoardEnterCardIds.add(event.cardId);
        hiddenMindbugTravelCardIds.add(event.cardId);
        state = stolenState;
        render();
        await animateMindbugSteal(stolenCard, sourceRect);

        const returnSourceRect = measureBoardSlotRect(event.cardId);
        suppressedBoardEnterCardIds.add(event.cardId);
        hiddenMindbugTravelCardIds.add(event.cardId);
        state = nextState;
        render();
        const finalOwnerIndex = ownerIndexForBoardCard(event.cardId);
        const finalCard = state.players[finalOwnerIndex]?.board.find(item => item.id === event.cardId);
        if (finalCard) {
          showRemoteMessage(`${displayCardName(finalCard)} kích hoạt hiệu ứng`, "");
          await animateMindbugSteal(finalCard, returnSourceRect, { sound: "ability" });
        }
        return;
      }
    }
    suppressedBoardEnterCardIds.add(event.cardId);
    hiddenMindbugTravelCardIds.add(event.cardId);
    state = nextState;
    render();
    const ownerIndex = ownerIndexForBoardCard(event.cardId);
    const card = state.players[ownerIndex]?.board.find(item => item.id === event.cardId);
    if (card) await animateMindbugSteal(card, sourceRect);
    return;
  }
  if (event.type === "attack-intent") {
    playSoundEffect("attack");
    if (ownerIndexForBoardCard(event.attackerId) >= 0 && !isCardAnimationState(event.attackerId, CARD_ANIMATION_STATE.ATTACK_INTENT)) {
      await enterAttackIntent(event.attackerId, event.actorIndex);
    }
    await playDuelDiscardAllFxIfNeeded(event);
    if (isLurkerSneakyAttackEvent(event)) await wait(motionMs(520));
    return;
  }
  if (event.type === "frenzy-again") {
    if (ownerIndexForBoardCard(event.attackerId) >= 0 && !isCardAnimationState(event.attackerId, CARD_ANIMATION_STATE.ATTACK_INTENT)) {
      await enterAttackIntent(event.attackerId, event.actorIndex);
    }
    if (event.actorIndex === 0) {
      window.setTimeout(() => sendDuelAction({ type: "attack", cardId: event.attackerId }), motionMs(80));
    }
    return;
  }
  if (event.type === "frenzy-stop") {
    if (isCardAnimationState(event.attackerId, CARD_ANIMATION_STATE.ATTACK_INTENT)) {
      await exitAttackIntent(event.attackerId, event.actorIndex);
    }
    return;
  }
  if (event.type === "attack-face") {
    if (!isCardAnimationState(event.attackerId, CARD_ANIMATION_STATE.ATTACK_INTENT)) {
      await enterAttackIntent(event.attackerId, event.actorIndex);
    }
    await playDuelDiscardAllFxIfNeeded(event);
    if (isLurkerSneakyAttackEvent(event)) await wait(motionMs(520));
    await resolveAttackIntentFace(event.attackerId, event.actorIndex, () => playDuelLifeDeltaFxFromStateDiff(state, nextState));
    playDuelDrawToFiveFx(event.drawnToFive);
    await playHyenixReviveFxFromStateDiff(state, nextState);
    return;
  }
  if (event.type === "attack-creature") {
    const eventDepartingIds = Array.isArray(event.defeatedIds) ? event.defeatedIds.filter(Boolean) : [];
    const departingIds = eventDepartingIds.length
      ? eventDepartingIds
      : boardCardIdsRemovedByNextState(state, nextState);
    let rotate = "";
    if (isCardAnimationState(event.attackerId, CARD_ANIMATION_STATE.ATTACK_INTENT)) {
      rotate = await finishAttackIntentForCreature(event.attackerId, event.actorIndex, event.blockerId);
    }
    await playDuelDiscardAllFxIfNeeded(event);
    if (isLurkerSneakyAttackEvent(event)) await wait(motionMs(520));
    await animateAttackCreature(event.attackerId, event.blockerId, rotate);
    const hasSequencedLifeEffect = event.defeatedEffects?.some(effect => Number(effect.lifeGain) > 0);
    if (!hasSequencedLifeEffect) await playDuelLifeDeltaFxFromStateDiff(state, nextState);
    await animateDuelDefeatedIds(departingIds, event.defeatedEffects);
    if (hasSequencedLifeEffect) await playDuelLifeDeltaFxFromStateDiff(state, nextState);
    playDuelDrawToFiveFx(event.drawnToFive);
  }
}

function shouldDeferDuelLifeDelta(event) {
  if (event?.defeatedEffects?.some(effect => Number(effect.lifeGain) > 0)) return true;
  if (
    event?.type === "ability-defeat"
    && ["attack-face", "attack-creature"].includes(event.afterEvent?.type)
  ) {
    return true;
  }
  return ["action-evolve", "attack-face", "attack-creature"].includes(event?.type);
}

async function playDuelDiscardAllFxIfNeeded(event) {
  if (!duelModeActive || event?.ability !== "discard-all" || !event.discardAll) return;
  await discardWholeHandAndDeck(event.discardAll.playerIndex, event.discardAll);
}

function isLurkerSneakyAttackEvent(event) {
  const sourceName = event?.sourceCard?.name ?? findCardById(event?.attackerId)?.name;
  return event?.ability === "keyword" && sourceName === "The Lurker";
}

function syncCardAttackStateFromNextState(event, nextState) {
  if (!nextState || !["attack-intent", "attack-face", "attack-creature"].includes(event?.type)) return;
  const ids = [event.attackerId, event.blockerId].filter(Boolean);
  for (const cardId of ids) {
    const currentCard = findCardById(cardId);
    const nextCard = findCardByIdInState(nextState, cardId);
    if (!currentCard || !nextCard) continue;
    currentCard.lurkerSneakyThisTurn = Boolean(nextCard.lurkerSneakyThisTurn);
    currentCard.cannotBlockThisTurn = Boolean(nextCard.cannotBlockThisTurn);
    currentCard.damage = nextCard.damage ?? currentCard.damage;
  }
}

function findCardByIdInState(sourceState, cardId) {
  for (const player of sourceState?.players ?? []) {
    for (const zone of ["board", "hand", "discard", "deck"]) {
      const card = player?.[zone]?.find?.(item => item.id === cardId);
      if (card) return card;
    }
  }
  return null;
}

function hyenixRevivedFromStateDiff(previousState, nextState) {
  const revived = [];
  for (let ownerIndex = 0; ownerIndex < 2; ownerIndex += 1) {
    const previousDiscardIds = new Set(
      (previousState?.players?.[ownerIndex]?.discard ?? [])
        .filter(card => card.name === "Hyenix")
        .map(card => card.id)
    );
    if (!previousDiscardIds.size) continue;
    for (const card of nextState?.players?.[ownerIndex]?.board ?? []) {
      if (card.name === "Hyenix" && previousDiscardIds.has(card.id)) {
        revived.push({ card, ownerIndex });
      }
    }
  }
  return revived;
}

async function playHyenixReviveFxFromStateDiff(previousState, nextState) {
  const revived = hyenixRevivedFromStateDiff(previousState, nextState);
  for (const item of revived) {
    const sourceRect = measureDiscardPileCardRect(item.ownerIndex);
    await revealHyenixFromDiscard(item.card, item.ownerIndex, sourceRect);
  }
}

function playExplicitDiscardDrawFx(event) {
  if (!duelModeActive || event?.type !== "ability-discard" || event.drawnToFive?.count <= 0) return;
  playDuelDrawToFiveFx(event.drawnToFive);
}

function playDuelDrawToFiveFx(drawnToFive) {
  if (!duelModeActive || drawnToFive?.count <= 0) return;
  const playerIndex = drawnToFive.playerIndex;
  if (playerIndex === 1) opponentHandSlotOffset -= drawnToFive.count;
  queueDeckDrawFx(playerIndex, drawnToFive.count);
  drawToFive(state.players[playerIndex], false);
  render();
}

function playDuelDrawFxFromStateDiff(previousState, nextState) {
  if (!duelModeActive || !previousState || !nextState) return;
  const diffKey = JSON.stringify((previousState.players ?? []).map((player, index) => ({
    index,
    beforeHand: player?.hand?.length ?? 0,
    beforeDeck: player?.deck?.length ?? 0,
    afterHand: nextState.players?.[index]?.hand?.length ?? 0,
    afterDeck: nextState.players?.[index]?.deck?.length ?? 0
  })));
  if (diffKey === lastDuelDrawFxDiffKey) return;
  lastDuelDrawFxDiffKey = diffKey;
  for (let playerIndex = 0; playerIndex < 2; playerIndex += 1) {
    const beforeHand = previousState.players?.[playerIndex]?.hand?.length;
    const afterHand = nextState.players?.[playerIndex]?.hand?.length;
    const beforeDeck = previousState.players?.[playerIndex]?.deck?.length;
    const afterDeck = nextState.players?.[playerIndex]?.deck?.length;
    if (![beforeHand, afterHand, beforeDeck, afterDeck].every(Number.isFinite)) continue;
    const drawn = beforeDeck - afterDeck;
    if (afterHand < beforeHand || drawn <= 0) continue;
    if (playerIndex === 1) opponentHandSlotOffset -= drawn;
    queueDeckDrawFx(playerIndex, drawn);
  }
}

async function animateDuelDefeatedIds(ids = [], defeatedEffects = []) {
  const uniqueIds = [...new Set((ids ?? []).filter(Boolean))];
  for (const cardId of uniqueIds) {
    await animateBoardCardExitAndHide(cardId);
    const effect = defeatedEffects.find(item => item.cardId === cardId);
    if (!effect) continue;
    playSoundEffect("ability");
    showRemoteMessage(`${displayCardName({ name: effect.cardName })} kích hoạt hiệu ứng`, "");
    if (Number(effect.lifeGain) > 0 && state.players[effect.ownerIndex]) {
      await gainLife(state.players[effect.ownerIndex], Number(effect.lifeGain));
    } else {
      await wait(motionMs(220));
    }
  }
}

async function animateBoardCardExitAndHide(cardId) {
  await animateBoardCardExit(cardId);
  clearCardAnimationState(CARD_ANIMATION_STATE.BOARD_EXIT, cardId);
  hiddenBoardExitCardIds.add(cardId);
  render();
}

function boardCardIdsRemovedByNextState(currentState, nextState) {
  if (!currentState || !nextState) return [];
  const nextIds = new Set();
  for (const player of nextState.players ?? []) {
    for (const card of player.board ?? []) nextIds.add(card.id);
  }
  const removed = [];
  for (const player of currentState.players ?? []) {
    for (const card of player.board ?? []) {
      if (!nextIds.has(card.id)) removed.push(card.id);
    }
  }
  return removed;
}

function applyAuthoritativeDuelState(serverState, room = null, event = "", options = {}) {
  if (!serverState) return;
  if (room) applyDuelRoom(room);
  duelModeActive = true;
  const previousActive = state?.active;
  const previousPendingKey = state?.pending
    ? `${state.pending.type}:${state.pending.cardId ?? state.pending.attackerId ?? ""}:${state.pending.actorIndex ?? ""}`
    : "";
  const localized = localizeServerState(serverState, room);
  if (!localized) return;
  const keepOpponentAbilityMessage = Boolean(opponentAbilityCardFromEvent(event));
  applyingRemoteDuelState = true;
  clearTransientChoicesForRemoteState();
  state = localized;
  if (event?.type === "mindbug-steal") {
    syncOpponentAbilityMessageAfterMindbugSteal(event);
  }
  hiddenBoardExitCardIds.clear();
  hiddenEvolutionCardIds.clear();
  if (state.winner === null) closeGameOverDialog();
  const nextPendingKey = state.pending
    ? `${state.pending.type}:${state.pending.cardId ?? state.pending.attackerId ?? ""}:${state.pending.actorIndex ?? ""}`
    : "";
  if (!options.preserveTransient && previousPendingKey !== nextPendingKey) clearCardAnimationState();
  if (state.pending?.type === "mindbug" && state.pending.actorIndex === 0) {
    pendingMindbug = {
      actorIndex: 0,
      playedByIndex: state.pending.playedByIndex,
      cardId: state.pending.cardId
    };
    showRemoteMessage("CƯỚP", "");
  }
  if (state.pending?.type === "block" && state.pending.actorIndex === 0) {
    showRemoteMessage("Chặn?", "");
  }
  if (state.pending?.type === "mindbug" && state.pending.actorIndex === 1) {
    showRemoteMessage("Chờ Cướp", "");
  }
  if (state.pending?.type === "block" && state.pending.actorIndex === 1) {
    showRemoteMessage("Chờ Chặn", "");
  }
  if (state.pending?.type === "frenzy" && state.pending.actorIndex === 0) {
    showRemoteMessage("Đánh lần 2?", "");
  }
  if (state.pending?.type === "frenzy" && state.pending.actorIndex === 1) {
    showRemoteMessage("Chờ đánh lần 2", "");
  }
  if (state.pending?.type === "hunter" && state.pending.actorIndex === 0) {
    showRemoteMessage(state.pending.mustTargetCreature ? "Captain Hippo: chọn mục tiêu" : "Trực tiếp/Quái vật", "", { sticky: true });
  }
  if (state.pending?.type === "hunter" && state.pending.actorIndex === 1) {
    showRemoteMessage("Chờ chọn đối tượng BẮN TỈA", "");
  }
  if (state.pending?.type === "received-card" && state.pending.actorIndex === 0) {
    showRemoteMessage("Chơi hay giữ?", displayCardName(state.pending.card), { sticky: true });
  }
  if (state.pending?.type === "received-card" && state.pending.actorIndex === 1) {
    showRemoteMessage("Chờ đối thủ chọn", "");
  }
  if (!(state.pending?.type === "received-card" && state.pending.actorIndex === 0)) {
    clearReceivedCardOverlayState({ reveal: true });
    for (const cardId of [...hiddenReceivedHandCardIds]) {
      const stillInLocalHand = state.players[0]?.hand.some(card => card.id === cardId);
      if (!stillInLocalHand) hiddenReceivedHandCardIds.delete(cardId);
    }
  }
  syncDuelAbilityPendingSelections();
  if (!state.pending && state.winner === null) {
    if (state.active === 0) {
      if (remoteMessageKind !== "your-turn" || els.remoteMessage?.hidden) {
        showRemoteMessage("Lượt của bạn", "", { kind: "your-turn" });
        if (previousActive !== 0) playSoundEffect("turn");
      }
    } else {
      clearRemoteMessage();
    }
  }
  render();
  if (state.winner !== null) {
    showRemoteMessage(state.winner === 0 ? "Thắng" : "Thua", "", { sticky: true });
    showGameOverDialog(state.winner);
  }
  applyingRemoteDuelState = false;
}

function findCardById(cardId) {
  for (const player of state.players ?? []) {
    for (const zone of ["hand", "board", "discard"]) {
      const card = player[zone]?.find(item => item.id === cardId);
      if (card) return card;
    }
  }
  return null;
}

function pendingSourceCard(pending) {
  return findCardById(pending?.sourceCard?.id) ?? pending?.sourceCard ?? null;
}

function pendingAbilityLabel(pending) {
  if (!pending) return "";
  if (pending.type === "mindbug") return "Cướp";
  if (pending.type === "discard") return "Bắt bỏ bài";
  if (pending.type === "discard-pile") return "Hồi sinh";
  if (pending.type === "defeat") return "Hạ Quái vật";
  if (pending.type === "disable-block") return "Khóa chặn";
  if (pending.type === "give-card") return "Đưa bài";
  if (pending.type === "received-card") return "Chơi hoặc giữ";
  if (pending.type === "steal") return "Cướp Quái vật";
  if (pending.type === "forced-attack") return "Ép tấn công";
  if (pending.type === "hunter") return "Bắn tỉa";
  if (pending.type === "block") return "Tấn công";
  if (pending.type === "frenzy") return "Đánh 2 lần";
  if (pending.type === "hyenix") return "Hồi sinh";
  if (pending.type === "dr-orange") return "Kích hoạt năng lực";
  if (pending.type === "earwig") return "Kích hoạt năng lực";
  if (pending.type === "experiment") return "Đổi Quái vật";
  if (pending.type === "utility-play") return "Sao chép PLAY ability";
  return "";
}

function clearReceivedCardOverlayState({ reveal = true } = {}) {
  if (!receivedCardOverlay) return;
  if (reveal) hiddenReceivedHandCardIds.delete(receivedCardOverlay.cardId);
  receivedCardOverlay = null;
}

function ensureReceivedCardInspectOverlay(card, ownerIndex) {
  if (!card || ownerIndex !== 0) return;
  if (receivedCardOverlay?.cardId === card.id && els.cardInspectDialog?.open) return;
  receivedCardOverlay = { cardId: card.id, ownerIndex };
  hiddenReceivedHandCardIds.add(card.id);
  showInspectCardImmediately(card, ownerIndex, "hand", null);
  renderHand();
}

function opponentAbilityMessageFromCard(card, message = "") {
  if (!card) return null;
  const text = message || displayAbility(card);
  if (!hasDisplayableAbilityText(text)) return null;
  return {
    card: { id: card.id, name: card.name },
    title: displayCardName(card),
    text
  };
}

function setOpponentAbilityMessage(card, message = "") {
  opponentAbilityMessage = opponentAbilityMessageFromCard(card, message);
  renderOpponentPendingAbilityOverlay();
}

function opponentAbilityCardFromEvent(event) {
  if (!duelModeActive || !event || typeof event !== "object") return null;
  if (event.type === "mindbug-steal") {
    return event.actorIndex === 1 ? event.card ?? findCardById(event.cardId) : null;
  }
  if (event.type === "play-card" && event.actorIndex === 1 && event.card) {
    return event.card;
  }
  const actorOwnsEffect = event.actorIndex === 1 || event.playedByIndex === 1;
  if (event.card && actorOwnsEffect && (event.ability || event.pending || event.type === "ability-pending")) {
    return event.card;
  }
  if (
    event.sourceCard
    && (event.ability || event.type === "ability-pending" || event.type?.startsWith("ability-"))
    && (event.actorIndex === 1 || ownerIndexForBoardCard(event.sourceCard.id) === 1)
  ) {
    return event.sourceCard;
  }
  return null;
}

function syncOpponentAbilityMessageAfterMindbugSteal(event) {
  const cardId = event?.cardId ?? event?.card?.id ?? "";
  if (!cardId) return;
  const ownerIndex = ownerIndexForBoardCard(cardId);
  const card = findCardById(cardId) ?? event.card ?? null;
  if (ownerIndex === 1 && card) {
    const nextMessage = opponentAbilityMessageFromCard(card, displayAbility(card));
    if (nextMessage) opponentAbilityMessage = nextMessage;
  }
}

function opponentPendingAbilityInfo() {
  if (!duelModeActive || !state.pending) return null;
  const sourceId = state.pending.sourceCard?.id ?? state.pending.cardId ?? state.pending.attackerId ?? "";
  if (!sourceId || ownerIndexForBoardCard(sourceId) !== 1) return null;
  const sourceCard = findCardById(sourceId) ?? state.pending.sourceCard ?? null;
  if (!sourceCard) return null;
  return opponentAbilityMessageFromCard(sourceCard, displayAbility(sourceCard));
}

function syncDuelAbilityPendingSelections() {
  if (!duelModeActive || !state.pending) return;
  const pending = state.pending;
  if (!["discard", "discard-pile", "defeat", "forced-attack", "steal", "experiment", "utility-play", "give-card", "disable-block", "received-card", "hyenix", "dr-orange", "earwig"].includes(pending.type)) return;
  const sourceCard = pendingSourceCard(pending);
  const cardIds = new Set(pending.cardIds ?? []);
  if (pending.type === "dr-orange") {
    if (pending.actorIndex === 0) {
      drOrangeChoicePrompt = {
        cardId: pending.sourceCard?.id ?? "",
        actorIndex: 0,
        resolve: activate => sendDuelAction({ type: "dr-orange-choice", activate })
      };
      showRemoteMessage("Kích hoạt năng lực?", displayCardName(sourceCard), { sticky: true });
    } else {
      showRemoteMessage("Chờ đối thủ lựa chọn", displayCardName(sourceCard));
    }
    return;
  }
  if (pending.type === "earwig") {
    if (pending.actorIndex === 0) {
      earwigChoicePrompt = {
        cardId: pending.sourceCard?.id ?? "",
        actorIndex: 0,
        resolve: activate => sendDuelAction({ type: "earwig-choice", activate })
      };
      showRemoteMessage("Kích hoạt năng lực?", displayCardName(sourceCard), { sticky: true });
    } else {
      showRemoteMessage("Chờ đối thủ lựa chọn", displayCardName(sourceCard));
    }
    return;
  }
  if (pending.type === "experiment") {
    if (pending.actorIndex === 0) {
      stealSelection = {
        turnOwnerIndex: pending.after?.actorIndex ?? state.active,
        actorIndex: pending.actorIndex,
        ownerIndex: pending.enemyIndex,
        sourceCard,
        cardIds,
        allowSkip: false,
        resolve: cardId => sendDuelAction({ type: "experiment-choice", cardId })
      };
      showRemoteMessage("Chọn Quái vật để đổi", "", { sticky: true });
    } else {
      showRemoteMessage("Chờ đối thủ chọn Quái vật", "");
    }
    return;
  }
  if (pending.type === "utility-play") {
    if (pending.actorIndex === 0) {
      utilityKeywordSelection = {
        actorIndex: pending.actorIndex,
        sourceCard,
        cardIds,
        resolve: cardId => sendDuelAction({ type: "utility-play-choice", cardId })
      };
      showRemoteMessage("Chọn Quái vật để sao chép PLAY ability", "", { sticky: true });
    } else {
      showRemoteMessage("Chờ đối thủ chọn PLAY ability", "");
    }
    return;
  }
  if (pending.type === "discard") {
    const ownerIndex = pending.playerIndex;
    if (pending.actorIndex === 0) {
      discardSelection = {
        ownerIndex,
        turnOwnerIndex: pending.after?.actorIndex ?? state.active,
        sourceCard,
        cardIds: new Set(state.players[ownerIndex]?.hand.map(card => card.id) ?? []),
        actionLabel: "Bỏ",
        resolve: cardId => sendDuelAction({ type: "discard-choice", cardId })
      };
      showRemoteMessage("Chọn 1 lá để bỏ", pending.amount > 1 ? `(${pending.selectedCount ?? 0}/${pending.amount})` : "", { sticky: true });
    } else {
      showRemoteMessage("Chờ bỏ bài", pending.amount > 1 ? `(${pending.selectedCount ?? 0}/${pending.amount})` : "");
    }
    return;
  }
  if (pending.type === "give-card") {
    const ownerIndex = pending.playerIndex;
    if (pending.actorIndex === 0) {
      discardSelection = {
        ownerIndex,
        turnOwnerIndex: pending.after?.actorIndex ?? state.active,
        sourceCard,
        cardIds: new Set(state.players[ownerIndex]?.hand.map(card => card.id) ?? []),
        actionLabel: "Đưa",
        resolve: cardId => sendDuelAction({ type: "give-card-choice", cardId })
      };
      showRemoteMessage("Chọn 1 lá để đưa", "", { sticky: true });
    } else {
      showRemoteMessage("Chờ đối thủ đưa bài", "");
    }
    return;
  }
  if (pending.type === "received-card") {
    if (state.pending?.type === "received-card" && state.pending.actorIndex === 0) {
      const card = state.players[pending.playerIndex]?.hand.find(item => item.id === pending.cardId) ?? pending.card ?? null;
      ensureReceivedCardInspectOverlay(card, pending.playerIndex);
    }
    if (pending.actorIndex === 0) {
      showRemoteMessage("Chơi hay giữ?", displayCardName(pending.card), { sticky: true });
    } else {
      showRemoteMessage("Chờ đối thủ chọn", "");
    }
    return;
  }
  if (pending.type === "hyenix") {
    const ownerIndex = pending.playerIndex;
    const card = state.players[ownerIndex]?.discard.find(item => item.id === pending.cardId) ?? pending.sourceCard ?? null;
    if (pending.actorIndex === 0) {
      setOpponentAbilityMessage(card, displayAbility(card));
      showRemoteMessage("Chơi từ Mộ bài?", displayCardName(card), { sticky: true });
      showHyenixChoiceOverlay(card, ownerIndex, measureDiscardPileCardRect(ownerIndex)).catch(() => {});
    } else {
      showRemoteMessage("Chờ lựa chọn", displayCardName(card));
    }
    return;
  }
  if (pending.type === "discard-pile") {
    if (pending.actorIndex === 0) {
      discardPileSelection = {
        actorIndex: pending.actorIndex,
        ownerIndex: pending.sourceOwnerIndex,
        sourceCard,
        cardIds,
        resolve: cardId => sendDuelAction({ type: "discard-pile-choice", cardId })
      };
      showRemoteMessage("Chọn Quái vật để hồi sinh", "", { sticky: true });
      openDiscardDialog(pending.sourceOwnerIndex);
    } else {
      showRemoteMessage("Chờ hồi sinh", "");
    }
    return;
  }
  if (pending.type === "defeat") {
    if (pending.actorIndex === 0) {
      defeatSelection = {
        turnOwnerIndex: pending.after?.actorIndex ?? state.active,
        actorIndex: pending.actorIndex,
        ownerIndex: pending.ownerIndex,
        sourceCard,
        cardIds,
        resolve: cardId => sendDuelAction({ type: "defeat-choice", cardId })
      };
      showRemoteMessage("Chọn Quái vật để giết", "", { sticky: true });
    } else {
      showRemoteMessage("Chờ chọn mục tiêu", "");
    }
    return;
  }
  if (pending.type === "forced-attack") {
    if (pending.actorIndex === 0) {
      defeatSelection = {
        turnOwnerIndex: pending.after?.actorIndex ?? state.active,
        actorIndex: pending.actorIndex,
        ownerIndex: pending.attackerIndex,
        sourceCard,
        cardIds,
        resolve: cardId => sendDuelAction({ type: "forced-attack-choice", cardId })
      };
      showRemoteMessage("Chọn Quái vật địch để ép tấn công", "", { sticky: true });
    } else {
      showRemoteMessage("Chờ chọn Quái vật tấn công", "");
    }
    return;
  }
  if (pending.type === "disable-block") {
    if (pending.actorIndex === 0) {
      disableBlockSelection = {
        turnOwnerIndex: pending.after?.actorIndex ?? state.active,
        actorIndex: pending.actorIndex,
        ownerIndex: pending.ownerIndex,
        sourceCard,
        cardIds,
        resolve: cardId => sendDuelAction({ type: "disable-block-choice", cardId })
      };
      showRemoteMessage("Chọn Quái vật không thể chặn", "", { sticky: true });
    } else {
      showRemoteMessage("Chờ chọn mục tiêu", "");
    }
    return;
  }
  if (pending.type === "steal") {
    if (pending.actorIndex === 0) {
      stealSelection = {
        turnOwnerIndex: pending.after?.actorIndex ?? state.active,
        actorIndex: pending.actorIndex,
        ownerIndex: pending.ownerIndex,
        sourceCard,
        cardIds,
        allowSkip: Boolean(pending.allowSkip),
        resolve: cardId => sendDuelAction({ type: "steal-choice", cardId })
      };
      showRemoteMessage("Chọn Quái vật để cướp", "", { sticky: true });
    } else {
      showRemoteMessage("Chờ chọn mục tiêu", "");
    }
  }
}

function syncDuelHunterTargetSelection() {
  const forcedByCaptainHippo = Boolean(state.pending?.type === "hunter" && state.pending.mustTargetCreature);
  if (!duelModeActive || state.pending?.type !== "hunter" || state.pending.actorIndex !== 0 || (!duelHunterTargetSelectionMode && !forcedByCaptainHippo)) {
    if (duelModeActive && state.pending?.type !== "hunter") hunterTargetSelection = null;
    return;
  }
  const attacker = state.players[state.pending.attackerIndex]?.board.find(card => card.id === state.pending.attackerId) ?? null;
  hunterTargetSelection = {
    actorIndex: state.pending.actorIndex,
    ownerIndex: 1 - state.pending.attackerIndex,
    attacker,
    cardIds: new Set(state.pending.targetIds ?? []),
    resolve: cardId => sendDuelAction({ type: "hunter-choice", choice: "creature", cardId })
  };
}

function applyDuelRoom(room) {
  if (!room?.code) return;
  const keepProfileOverlay = lobbyScreen === "profile";
  const players = Array.isArray(room.players) ? room.players : [];
  const localIndex = Math.max(0, players.findIndex(player => player.id === duelClientId));
  const opponent = players.find((_, index) => index !== localIndex);
  if (opponent) playerAvatars[1] = opponent.avatar;
  setDuelPlayerColorRoles(room, localIndex);
  lobbyMode = "duel";
  lobbyRoom = {
    online: true,
    host: room.hostId === duelClientId,
    code: room.code,
    players,
    localIndex,
    started: Boolean(room.started)
  };
  saveDuelRoomCode(room.code);
  lobbyProfileReturnScreen = "waiting";
  lobbyScreen = keepProfileOverlay ? "profile" : "waiting";
  updateLobbyScreen();
}

function leaveDuelRoom() {
  if (lobbyRoom?.online) duelSocket?.emit("leave-room");
  lobbyRoom = null;
  resetPlayerColorRoles();
  lobbyScreen = "duel";
  updateLobbyScreen();
}

function createRoomCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function copyRoomCode(code) {
  try {
    await navigator.clipboard?.writeText?.(String(code));
  } catch {
    // Clipboard access can be unavailable on local or non-secure contexts.
  }
}

function enterLobbyWaitingRoom({ host, roomCode }) {
  lobbyMode = "duel";
  lobbyRoom = {
    host: Boolean(host),
    code: String(roomCode || createRoomCode()).replace(/\D/g, "").slice(0, 4).padStart(4, "0"),
    guestReady: !host
  };
  lobbyScreen = "waiting";
  updateLobbyScreen();
}

function renderLobbyWaitingRoom() {
  if (!lobbyRoom) return;
  if (els.lobbyRoomCode) els.lobbyRoomCode.textContent = `Phòng: ${lobbyRoom.code}`;
  if (els.lobbyWaitingText) {
    const hasOpponent = lobbyRoom.online
      ? (lobbyRoom.players?.length ?? 0) >= 2
      : lobbyRoom.guestReady;
    els.lobbyWaitingText.textContent = lobbyDuelStatus || (hasOpponent
      ? "Đủ người. Chủ phòng có thể bắt đầu."
      : lobbyRoom.host
        ? "Đang chờ người chơi khác..."
        : "Đang chờ host bắt đầu...");
  }
  renderLobbyWaitingSlots();
  if (els.lobbyRoomStartButton) {
    els.lobbyRoomStartButton.hidden = !lobbyRoom.host;
    els.lobbyRoomStartButton.disabled = Boolean(lobbyRoom.online && (lobbyRoom.players?.length ?? 0) < 2);
  }
}

function renderLobbyWaitingSlots() {
  if (!els.lobbyWaitingSlots || !lobbyRoom) return;
  const onlinePlayers = lobbyRoom.online ? (lobbyRoom.players ?? []) : [];
  const localOnlineIndex = Number.isInteger(lobbyRoom.localIndex) ? lobbyRoom.localIndex : 0;
  const slots = lobbyRoom.online
    ? [0, 1].map(index => {
      const player = onlinePlayers[index];
      return player
        ? {
          active: true,
          editable: index === localOnlineIndex,
          avatar: player.avatar,
          name: sanitizePlayerName(player.name),
          status: player.ready ? "Sẵn sàng" : "Đang chờ",
          badge: player.ready ? "✓" : ""
        }
        : { active: false, editable: false, avatar: 0, name: "Đang chờ", status: "Trống", badge: "" };
    })
    : [
      {
        active: true,
        editable: true,
        avatar: playerAvatars[0],
        name: sanitizePlayerName(localPlayerName),
        status: "Sẵn sàng",
        badge: "✓"
      },
      lobbyRoom.host
        ? { active: false, editable: false, avatar: 0, name: "Đang chờ", status: "Trống", badge: "" }
        : { active: true, editable: false, avatar: playerAvatars[1], name: "Đối thủ", status: "Sẵn sàng", badge: "✓" }
    ];
  els.lobbyWaitingSlots.innerHTML = slots.map(slot => `
    <article class="lobbyWaitingSlot ${slot.active ? "active" : ""} ${slot.editable ? "editable" : ""}">
      ${slot.editable ? `
        <button class="lobbyWaitingProfileButton" type="button" data-waiting-profile="local" aria-label="Chỉnh nhân vật">
          <span class="lobbyWaitingAvatar">
            <img src="${avatarUrl(slot.avatar)}" alt="">
          </span>
          <strong>${slot.name}</strong>
        </button>
      ` : `
        <span class="lobbyWaitingAvatar">
          ${slot.active ? `<img src="${avatarUrl(slot.avatar)}" alt="">` : ""}
        </span>
        <strong>${slot.name}</strong>
      `}
      <span class="lobbyWaitingReady">${slot.status}${slot.badge ? ` ${slot.badge}` : ""}</span>
    </article>
  `).join("");
  els.lobbyWaitingSlots.querySelector("[data-waiting-profile]")?.addEventListener("click", showProfileOverlay);
}

async function createDuelRoom() {
  setLobbyDuelStatus("Đang tạo phòng...");
  try {
    const socket = await connectDuelSocket();
    socket.emit("create-room", {
      profile: duelProfilePayload(),
      sessionId: duelClientId
    }, response => {
      if (!response?.ok) {
        setLobbyDuelStatus(response?.message || "Không tạo được phòng.");
        return;
      }
      applyDuelRoom(response.room);
      copyRoomCode(response.room.code);
      setLobbyDuelStatus("Đã copy mã phòng.");
    });
  } catch {
    setLobbyDuelStatus("Không kết nối được phòng online.");
  }
}

async function joinDuelRoom() {
  const code = String(els.lobbyRoomCodeInput?.value || "").replace(/\D/g, "").slice(0, 4);
  if (els.lobbyRoomCodeInput) els.lobbyRoomCodeInput.value = code;
  if (code.length < 4) return;
  setLobbyDuelStatus("Đang vào phòng...");
  try {
    const socket = await connectDuelSocket();
    socket.emit("join-room", { code, profile: duelProfilePayload(), sessionId: duelClientId }, response => {
      if (!response?.ok) {
        setLobbyDuelStatus(response?.message || "Không vào được phòng.");
        return;
      }
      applyDuelRoom(response.room);
      setLobbyDuelStatus("");
    });
  } catch {
    setLobbyDuelStatus("Không kết nối được phòng online.");
  }
}

function startDuelFromWaitingRoom() {
  if (!lobbyRoom?.host) return;
  if (lobbyRoom.online) {
    duelSocket?.emit("start-room", response => {
      if (!response?.ok) setLobbyDuelStatus(response?.message || "Không bắt đầu được phòng.");
    });
    return;
  }
  lobbyStarted = true;
  document.body.classList.remove("lobbyOpen");
  els.lobbyView?.classList.add("hidden");
  newGame({ randomizeBotAvatar: true });
}

async function startDuelMatch(room, seed = 0, serverState = null) {
  await ensureGameAssetsPreloaded({ showLobbyStatus: isLobbyVisible() });
  const players = Array.isArray(room?.players) ? room.players : [];
  const localIndex = Math.max(0, players.findIndex(player => player.id === duelClientId));
  const opponent = players.find((_, index) => index !== localIndex);
  if (opponent) playerAvatars[1] = opponent.avatar;
  setDuelPlayerColorRoles(room, localIndex);
  lobbyStarted = true;
  document.body.classList.remove("lobbyOpen");
  els.lobbyView?.classList.add("hidden");
  duelModeActive = true;
  clearCardAnimationState();
  handLayoutCache.clear();
  handLayoutVersions.clear();
  if (serverState) {
    applyAuthoritativeDuelState(serverState, room, `start:${seed}`);
    playOpeningDealSounds();
    return;
  }
  newGame({
    randomizeBotAvatar: false,
    duel: true,
    opponentName: opponent?.name || "Đối thủ",
    opponentAvatar: opponent?.avatar
  });
}

function showLobbySettings() {
  syncSfxVolumeControls();
  if (els.lobbySettingsOverlay) els.lobbySettingsOverlay.hidden = false;
}

function hideLobbySettings() {
  if (els.lobbySettingsOverlay) els.lobbySettingsOverlay.hidden = true;
}

function isLobbyVisible() {
  return Boolean(els.lobbyView && !els.lobbyView.classList.contains("hidden"));
}

function showGameSettings(event = null) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  if (isLobbyVisible()) return;
  hideGameConfirm();
  syncSfxVolumeControls();
  if (els.gameSettingsOverlay) els.gameSettingsOverlay.hidden = false;
}

function hideGameSettings() {
  if (els.gameSettingsOverlay) els.gameSettingsOverlay.hidden = true;
}

function syncSfxVolumeControls() {
  const level = getSfxVolumeLevel();
  const percent = ((level - 1) / 4) * 100;
  for (const slider of [els.lobbySfxVolumeSlider, els.gameSfxVolumeSlider]) {
    if (!slider) continue;
    slider.value = String(level);
    slider.style.setProperty("--volume-percent", `${percent}%`);
  }
  for (const label of [els.lobbySfxVolumeValue, els.gameSfxVolumeValue]) {
    if (label) label.textContent = `Mức ${level}/5`;
  }
}

function handleSfxVolumeInput(event, { preview = false } = {}) {
  const value = Number.parseInt(event.currentTarget?.value ?? "3", 10);
  const volume = setSfxVolumeLevel(value);
  syncSfxVolumeControls();
  if (preview && volume > 0) playSoundEffect("select");
}

function showGameConfirm({ title, text, onAccept }) {
  pendingGameConfirmAction = typeof onAccept === "function" ? onAccept : null;
  hideGameSettings();
  if (els.gameConfirmTitle) els.gameConfirmTitle.textContent = title;
  if (els.gameConfirmText) els.gameConfirmText.textContent = text;
  if (els.gameConfirmOverlay) els.gameConfirmOverlay.hidden = false;
}

function hideGameConfirm() {
  pendingGameConfirmAction = null;
  if (els.gameConfirmOverlay) els.gameConfirmOverlay.hidden = true;
}

function acceptGameConfirm() {
  const action = pendingGameConfirmAction;
  hideGameConfirm();
  if (action) action();
}

function confirmNewGameFromSettings() {
  showGameConfirm({
    title: "Ván mới",
    text: "Bắt đầu ván mới?",
    onAccept: requestNewGame
  });
}

function returnToLobby() {
  endHandScrubGesture();
  if (lobbyRoom?.online) duelSocket?.emit("leave-room");
  duelModeActive = false;
  closeGameOverDialog();
  closeInspectDialogInstant();
  closeDiscardDialog({ force: true });
  if (els.choiceDialog?.open) els.choiceDialog.close();
  hideGameSettings();
  hideGameConfirm();
  opponentAbilityMessage = null;
  clearRemoteMessage();
  state.phase = "lobby";
  lobbyStarted = false;
  lobbyRoom = null;
  saveDuelRoomCode("");
  lobbyScreen = lobbyProfileReady ? "mode" : "profile";
  els.lobbyView?.classList.remove("hidden");
  renderLobby();
  render();
}

function confirmReturnToLobby() {
  showGameConfirm({
    title: "Về sảnh",
    text: "Rời ván hiện tại và quay về sảnh?",
    onAccept: returnToLobby
  });
}

async function startGameFromLobby() {
  if (lobbyMode !== "solo") return;
  await ensureGameAssetsPreloaded({ showLobbyStatus: true });
  localPlayerName = sanitizePlayerName(els.lobbyPlayerName?.value ?? localPlayerName);
  saveLobbyProfile();
  configureBotDifficulty();
  duelModeActive = false;
  resetPlayerColorRoles();
  lobbyStarted = true;
  els.lobbyView?.classList.add("hidden");
  newGame({ randomizeBotAvatar: true });
}

function renderScoreboardSafe() {
  if (!state) return;
  renderScoreboard();
  renderHandActionPanels();
}

function newGame({ randomizeBotAvatar = true, duel = false, opponentName = "Kiva", opponentAvatar = null } = {}) {
  endHandScrubGesture();
  document.body.classList.remove("localGameLost");
  document.body.classList.remove("lobbyOpen");
  lobbyStarted = true;
  els.lobbyView?.classList.add("hidden");
  localPlayerName = sanitizePlayerName(els.lobbyPlayerName?.value ?? localPlayerName);
  saveLobbyProfile();
  configureBotDifficulty();
  duelModeActive = Boolean(duel);
  if (!duelModeActive) resetPlayerColorRoles();
  playerAvatars[0] = normalizeAvatarId(playerAvatars[0], 1);
  if (Number.isInteger(Number(opponentAvatar))) playerAvatars[1] = Number(opponentAvatar);
  else if (randomizeBotAvatar) playerAvatars[1] = randomAvatarId(playerAvatars[0]);
  playerAvatars[1] = normalizeAvatarId(playerAvatars[1], randomAvatarId(playerAvatars[0]));
  closeGameOverDialog();
  idCounter = 1;
  blockSelection = null;
  blockPrompt = null;
  discardSelection = null;
  discardPileSelection = null;
  defeatSelection = null;
  disableBlockSelection = null;
  stealSelection = null;
  hunterAttackPrompt = null;
  hunterTargetSelection = null;
  frenzySecondAttackPrompt = null;
  pendingMindbug = null;
  choicePromptActorIndex = null;
  inspectedLocalHandCardId = "";
  inspectedLocalBoardCardId = "";
  inspectedDiscardPileCardId = "";
  receivedCardOverlay = null;
  hiddenReceivedHandCardIds.clear();
  lastTurnPointerActive = null;
  debugTargetCardRect = null;
  opponentHandSlotOffset = 0;
  opponentAbilityMessage = null;
  lastGameOverSoundWinner = null;
  pendingFrostyDrawToFivePlayerIndex = null;
  clearCardAnimationState();
  hiddenBoardExitCardIds.clear();
  hiddenEvolutionCardIds.clear();
  waterdropActionFxPlayedCardIds.clear();
  suppressedBoardEnterCardIds.clear();
  handLayoutCache.clear();
  handLayoutVersions.clear();
  const deck = makeDeck();
  state = {
    players: [
      makePlayer(localPlayerName, deck.splice(0, 10)),
      makePlayer(duelModeActive ? sanitizePlayerName(opponentName) : "Kiva", deck.splice(0, 10))
    ],
    active: 0,
    phase: "action",
    log: [],
    winner: null,
    extraTurn: false,
    extraTurnSource: "",
    frenzyOnly: null
  };
  if (!duelModeActive) bot.startLearningGame();
  state.players.forEach((player, index) => markOriginalOwner(player.deck, index));
  state.players.forEach((player, index) => markOriginalOwner(player.extraDeck, index));
  for (const player of state.players) {
    drawToFive(player, false);
  }
  log("Ván mới bắt đầu.");
  const firstPlayerIndex = duelModeActive ? 0 : (Math.random() < 0.5 ? 0 : 1);
  state.active = firstPlayerIndex;
  playOpeningDealSounds();
  startTurn(firstPlayerIndex);
}

function makePlayer(name, deck) {
  return {
    name,
    life: STARTING_LIFE,
    mindbugs: STARTING_MINDBUGS,
    deck,
    extraDeck: makeExtraDeck(),
    evolutionArchive: [],
    hand: [],
    board: [],
    discard: []
  };
}

function markOriginalOwner(cards, ownerIndex) {
  for (const card of cards) {
    if (card.originalOwnerIndex === null || card.originalOwnerIndex === undefined) {
      card.originalOwnerIndex = ownerIndex;
    }
  }
}

function originalOwnerIndex(card, fallbackIndex) {
  return Number.isInteger(card?.originalOwnerIndex) ? card.originalOwnerIndex : fallbackIndex;
}

function discardToOriginalOwner(card, fallbackIndex) {
  const targetIndex = originalOwnerIndex(card, fallbackIndex);
  state.players[targetIndex]?.discard.push(card);
  return targetIndex;
}

function currentPlayer() {
  return state.players[state.active];
}

function opponentPlayer() {
  return state.players[1 - state.active];
}

function hasWinner() {
  return state.winner !== null;
}

function startTurn(index) {
  clearRemoteMessage();
  state.active = index;
  state.phase = "action";
  state.extraTurn = false;
  state.extraTurnSource = "";
  state.frenzyOnly = null;
  clearMindbugTurnFlags();
  for (const creature of currentPlayer().board) {
    creature.exhausted = false;
    creature.attacksThisTurn = 0;
  }
  log(`${currentPlayer().name} bắt đầu lượt.`);
  checkActionLoss();
  if (hasWinner()) {
    render();
    return;
  }
  render();
  if (index === 0) {
    showRemoteMessage("Lượt của bạn", "", { kind: "your-turn" });
    playSoundEffect("turn");
  }
  scheduleBotTurn();
}

function endTurn(next = 1 - state.active) {
  if (hasWinner()) return;
  drawToFive(currentPlayer());
  checkGameOver();
  if (hasWinner()) {
    render();
    return;
  }
  startTurn(next);
}

function drawToFive(player, animate = true) {
  let drawn = 0;
  while (player.hand.length < HAND_SIZE && player.deck.length) {
    player.hand.push(player.deck.shift());
    drawn += 1;
  }
  if (drawn && animate) queueDeckDrawFx(state.players.indexOf(player), drawn);
  if (state?.players?.[BOT_INDEX] === player && drawn) {
    opponentHandSlotOffset -= drawn;
  }
  return drawn;
}

function queueDeckDrawFx(playerIndex, count) {
  if (!Number.isInteger(playerIndex) || playerIndex < 0 || count <= 0) return;
  const startDelay = deckDrawFxItems.filter(item => item.playerIndex === playerIndex).length * 70;
  for (let i = 0; i < count; i += 1) {
    window.setTimeout(() => playSoundEffect("draw"), motionMs(startDelay + i * 80));
    deckDrawFxItems.push({
      id: deckDrawFxId++,
      playerIndex,
      delay: startDelay + i * 80
    });
  }
  window.setTimeout(() => {
    deckDrawFxItems = deckDrawFxItems.filter(item => item.playerIndex !== playerIndex);
    render();
  }, motionMs(startDelay + count * 80 + 380));
}

function playOpeningDealSounds() {
  for (let index = 0; index < 3; index += 1) {
    window.setTimeout(() => playSoundEffect("draw"), motionMs(120 + index * 165));
  }
}

function log(message) {
  state.log.unshift(message);
  state.log = state.log.slice(0, 40);
}

function wait(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function nextAnimationFrame() {
  return new Promise(resolve => window.requestAnimationFrame(resolve));
}

async function afterNextPaint() {
  await nextAnimationFrame();
  await nextAnimationFrame();
}

function motionMs(ms) {
  return ms * motionDurationScale;
}

function syncMotionDeltaCss() {
  document.documentElement.style.setProperty("--life-loss-duration", `${motionMs(760)}ms`);
  document.documentElement.style.setProperty("--life-gain-duration", `${motionMs(760)}ms`);
  document.documentElement.style.setProperty("--card-hit-duration", `${motionMs(420)}ms`);
  document.documentElement.style.setProperty("--board-card-exit-duration", `${motionMs(BOARD_CARD_EXIT_MS)}ms`);
  document.documentElement.style.setProperty("--screen-shake-duration", `${motionMs(220)}ms`);
  document.documentElement.style.setProperty("--direct-hit-flash-duration", `${motionMs(220)}ms`);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function calibrateMotionDelta() {
  return new Promise(resolve => {
    const samples = [];
    let lastTime = 0;
    const maxSamples = 18;
    const measure = time => {
      if (lastTime) samples.push(time - lastTime);
      lastTime = time;
      if (samples.length < maxSamples) {
        window.requestAnimationFrame(measure);
        return;
      }
      const averageFrameMs = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
      const targetFrameMs = 1000 / TARGET_MOTION_FPS;
      motionDurationScale = clamp(averageFrameMs / targetFrameMs, 1, 1.8);
      syncMotionDeltaCss();
      resolve();
    };
    window.requestAnimationFrame(measure);
  });
}

async function waitAfterBotAction(actorIndex) {
  if (actorIndex !== BOT_INDEX || hasWinner()) return;
  await wait(bot.afterActionDelay ?? 900);
}

function showRemoteMessage(title, message, options = {}) {
  window.clearTimeout(remoteMessageTimer);
  remoteMessageKind = options.kind || "";
  const inlineStep = typeof message === "string" && /^\(\d+\/\d+\)$/.test(message.trim())
    ? message.trim()
    : "";
  els.remoteMessage.classList.toggle("remoteMessageMindbug", title === "CƯỚP" && !options.cardName);
  renderRemoteMessageTitle(title, { ...options, inlineStep });
  els.remoteMessageText.textContent = inlineStep ? "" : message;
  els.remoteMessageText.hidden = Boolean(inlineStep || !message);
  els.remoteMessage.hidden = false;
}

function renderRemoteMessageTitle(title, options = {}) {
  els.remoteMessageTitle.textContent = "";
  if (!options.cardName) {
    els.remoteMessageTitle.textContent = title;
    appendRemoteMessageInlineStep(options.inlineStep);
    return;
  }
  const cardName = document.createElement("span");
  cardName.className = "remoteMessageCardName";
  cardName.textContent = options.cardName;
  const text = document.createElement("span");
  text.textContent = ` ${title}`;
  els.remoteMessageTitle.append(cardName, text);
  appendRemoteMessageInlineStep(options.inlineStep);
}

function appendRemoteMessageInlineStep(inlineStep) {
  if (!inlineStep) return;
  const step = document.createElement("span");
  step.className = "remoteMessageInlineStep";
  step.textContent = ` ${inlineStep}`;
  els.remoteMessageTitle.append(step);
}

function clearRemoteMessage() {
  window.clearTimeout(remoteMessageTimer);
  remoteMessageKind = "";
  els.remoteMessage.classList.remove("remoteMessageMindbug");
  els.remoteMessage.hidden = true;
}

function clearRemoteMessageForAction() {
  if (!els.remoteMessage.hidden) clearRemoteMessage();
}

function announceAbilityActivation(card, ownerIndex, triggerLabel) {
  playSoundEffect("ability");
  showRemoteMessage(
    "kích hoạt hiệu ứng",
    "",
    { cardName: displayCardName(card) }
  );
}

function clearMindbugTurnFlags() {
  for (const player of state.players) {
    for (const zone of [player.hand, player.deck, player.board, player.discard]) {
      for (const card of zone) card.mindbuggedThisTurn = false;
    }
    for (const card of player.board) {
      card.cannotBlockThisTurn = false;
      card.lurkerSneakyThisTurn = false;
      card.cannotBeDefeatedThisTurn = false;
    }
  }
}

function cardPower(card, ownerIndex) {
  let power = card.basePower;
  const owner = state.players[ownerIndex];
  if (CREATURE_ABILITIES_ENABLED && !animationTestMode) {
    if (card.name === "Goblin Werewolf" && ownerIndex === state.active) power += 6;
    if (card.name === "Lone Yeti" && owner.board.length === 1) power += 5;
    if (card.name === "Bugserker" && owner.life === 1) power += 8;
    if (card.name === "Froblin Instigator") power += Math.max(0, owner.board.length - 1) * 2;
    if (card.name === "Cheery Chimpborg" && state.players[1 - ownerIndex].board.length >= 3) power += 5;
    if (card.name === "Spiky Shinobi" && owner.mindbugs === 0) power += 5;
    for (const ally of owner.board) {
      if (ally.id === card.id) continue;
      if (ally.name === "Shield Bugs") power += 1;
      if (ally.name === "Urchin Hurler" && ownerIndex === state.active) power += 2;
      if (ally.name === "Coach Panda" && owner.board.length === 2) power += 3;
    }
  }
  return power;
}

function alliedPowerBonus(card, ownerIndex) {
  if (!CREATURE_ABILITIES_ENABLED || animationTestMode) return 0;
  const owner = state.players[ownerIndex];
  if (!owner?.board.some(boardCard => boardCard.id === card.id)) return 0;
  let bonus = 0;
  for (const ally of owner.board) {
    if (ally.id === card.id) continue;
    if (ally.name === "Shield Bugs") bonus += 1;
    if (ally.name === "Urchin Hurler" && ownerIndex === state.active) bonus += 2;
  }
  return bonus;
}

function cardKeywords(card, ownerIndex, visited = new Set()) {
  if (animationTestMode) return [];
  const visitKey = `${ownerIndex}:${card.id}`;
  if (visited.has(visitKey)) return [...card.keywords];
  visited.add(visitKey);
  const set = new Set(card.keywords);
  const owner = state.players[ownerIndex];
  const enemy = state.players[1 - ownerIndex];
  if (CREATURE_ABILITIES_ENABLED) {
    if (card.name === "Lone Yeti" && owner.board.length === 1) set.add("FRENZY");
    if (hasLurkerSneakyForAttack(card, ownerIndex)) set.add("SNEAKY");
    if (owner.board.some(ally => ally.id !== card.id && ally.name === "Kitsunsei")) set.add("SNEAKY");
    if (owner.board.length === 2 && owner.board.some(ally => ally.id !== card.id && ally.name === "Coach Panda")) set.add("FRENZY");
    if (card.name === "Shark Crab-Dog Mummypus") {
      const enemyKeywords = enemy.board.flatMap(enemyCard => cardKeywords(enemyCard, 1 - ownerIndex, new Set(visited)));
      for (const keyword of ["HUNTER", "SNEAKY", "FRENZY", "POISONOUS"]) {
        if (enemyKeywords.includes(keyword)) set.add(keyword);
      }
    }
    const thrower = owner.board.find(ally => ally.name === "Snail Thrower");
    if (thrower && thrower.id !== card.id && cardPower(card, ownerIndex) <= 4) {
      set.add("HUNTER");
      set.add("POISONOUS");
    }
  }
  return [...set];
}

function hasLurkerSneakyForAttack(card, ownerIndex) {
  if (card.name !== "The Lurker") return false;
  if (card.lurkerSneakyThisTurn) return true;
  const owner = state.players[ownerIndex];
  const enemy = state.players[1 - ownerIndex];
  if (!owner || !enemy || owner.board.length <= enemy.board.length) return false;
  const animationState = cardAnimationStates.get(card.id)?.name;
  return animationState === CARD_ANIMATION_STATE.ATTACK_INTENT
    || animationState === CARD_ANIMATION_STATE.ATTACK_RESOLVE_FACE
    || animationState === CARD_ANIMATION_STATE.ATTACK_RESOLVE_CREATURE;
}

function grantedKeywordTags(card, ownerIndex) {
  if (!CREATURE_ABILITIES_ENABLED || animationTestMode) return [];
  const owner = state.players[ownerIndex];
  if (!owner?.board.some(boardCard => boardCard.id === card.id)) return [];
  const baseKeywords = new Set(card.keywords);
  return cardKeywords(card, ownerIndex).filter(keyword => !baseKeywords.has(keyword));
}

function cardEffectTags(card, ownerIndex, zone) {
  if (zone !== "board") return { powerBonus: 0, keywords: [] };
  const basePower = Number.isFinite(card.basePower) ? card.basePower : cardPower(card, ownerIndex);
  const powerBonus = Math.max(0, cardPower(card, ownerIndex) - basePower);
  return {
    powerBonus,
    keywords: grantedKeywordTags(card, ownerIndex).map(keyword => ({
      key: keyword,
      label: displayKeyword(keyword)
    }))
  };
}

function isPlayAbilityBlocked(card, ownerIndex) {
  if (!CREATURE_ABILITIES_ENABLED || animationTestMode) return false;
  if (!Number.isInteger(ownerIndex) || !state?.players?.[ownerIndex]) return false;
  if (card.name === "Deathweaver" || !PLAY_ABILITY_CARDS.has(card.name)) return false;
  const enemy = state.players[1 - ownerIndex];
  return Boolean(enemy?.board.some(enemyCard => enemyCard.name === "Deathweaver"));
}

async function playCard(cardId) {
  if (state.phase !== "action" || hasWinner() || state.frenzyOnly) return;
  const playedByIndex = state.active;
  if (captainHippoForcedAttackers(playedByIndex).length) return;
  const player = currentPlayer();
  const opponent = opponentPlayer();
  const cardIndex = player.hand.findIndex(card => card.id === cardId);
  if (cardIndex < 0) return;
  if (!duelModeActive && !animationTestMode) {
    bot.recordGameAction(state, { type: "play", cardId }, playedByIndex);
  }
  clearRemoteMessageForAction();
  const botPlaySourceRect = playedByIndex === BOT_INDEX ? measureOpponentLeftmostHandCardRect() : null;
  const [card] = player.hand.splice(cardIndex, 1);
  playSoundEffect("playCard");
  if (playedByIndex === BOT_INDEX) {
    opponentHandSlotOffset += 1;
    opponentAbilityMessage = opponentAbilityMessageFromCard(card, displayAbility(card));
    renderOpponentPendingAbilityOverlay();
    render();
    await revealPlayedCardOverlay(card, playedByIndex, botPlaySourceRect);
  }
  const sourceZone = "hand";

  if (canUseMindbug(card, sourceZone, opponent)) {
    player.board.push(card);
    const choice = await waitForMindbugDecision(card, playedByIndex, 1 - playedByIndex);
    if (choice === "steal") {
      const sourceRect = measureBoardSlotRect(card.id);
      player.board = player.board.filter(boardCard => boardCard.id !== card.id);
      opponent.mindbugs -= 1;
      card.mindbuggedThisTurn = true;
      opponent.board.push(card);
      suppressedBoardEnterCardIds.add(card.id);
      hiddenMindbugTravelCardIds.add(card.id);
      showRemoteMessage("CƯỚP", "");
      log(`${opponent.name} dùng Mindbug và cướp ${card.name}.`);
      render();
      await animateMindbugSteal(card, sourceRect);
      await resolvePlayAbility(card, 1 - playedByIndex);
      state.active = playedByIndex;
      state.phase = "action";
      drawToFive(player);
      checkGameOver();
      checkActionLoss();
      if (hasWinner()) {
        render();
        return;
      }
      state.extraTurn = true;
      state.extraTurnSource = "mindbug";
      render();
      scheduleBotTurn();
      return;
    }
    clearCardAnimationState(CARD_ANIMATION_STATE.MINDBUG_PENDING, card.id);
    pendingMindbug = null;
    log(`${player.name} chơi ${card.name}.`);
    await resolvePlayAbility(card, playedByIndex);
    endTurn();
  } else {
    if (card.mindbuggedThisTurn) {
      log(`${card.name} không thể bị Mindbug lần nữa trong cùng lượt.`);
    }
    await summonForActive(card);
  }
  render();
}

function canUseMindbug(card, sourceZone, opponent) {
  return sourceZone === MINDBUG_SOURCE_ZONE
    && opponent.mindbugs > 0
    && !card.mindbuggedThisTurn;
}

function waitForMindbugDecision(card, playedByIndex, actorIndex) {
  return new Promise(resolve => {
    choiceDepth += 1;
    state.phase = "choice";
    setCardAnimationState(CARD_ANIMATION_STATE.MINDBUG_PENDING, card.id, { actorIndex, playedByIndex });
    pendingMindbug = { card, cardId: card.id, actorIndex, playedByIndex, resolve };
    render();
    if (actorIndex === BOT_INDEX) {
      window.setTimeout(() => {
        resolvePendingMindbugDecision(bot.chooseOption({
          type: "mindbug",
          actorIndex,
          card,
          options: [
            { label: `Dùng Mindbug (${state.players[actorIndex].mindbugs})`, value: "steal" },
            { label: "Không dùng", value: "pass" }
          ]
        }, state, botHelpers()) ?? "pass");
      }, bot.delay);
    }
  });
}

function resolvePendingMindbugDecision(value) {
  if (!pendingMindbug) return;
  const pending = pendingMindbug;
  pendingMindbug = null;
  choiceDepth -= 1;
  if (!choiceDepth && !hasWinner()) state.phase = "action";
  clearRemoteMessage();
  clearCardAnimationState(CARD_ANIMATION_STATE.MINDBUG_PENDING, pending.cardId);
  playSoundEffect(value === "steal" ? "mindbug" : "select");
  pending.resolve(value);
}

function findRenderedBoardSlot(cardId) {
  return els.arena?.querySelector(`.fieldCardSlot[data-card-id="${cardId}"]`) ?? null;
}

function findRenderedBoardCard(cardId) {
  return els.arena?.querySelector(`.fieldCardSlot[data-card-id="${cardId}"] > .card[data-card-id="${cardId}"]`) ?? null;
}

function measureBoardSlotRect(cardId) {
  const slot = findRenderedBoardSlot(cardId);
  if (!slot) return null;
  for (const animation of slot.getAnimations({ subtree: true })) {
    animation.cancel();
  }
  slot.style.opacity = "";
  const cardEl = slot.querySelector(".card");
  if (cardEl) {
    cardEl.style.opacity = "";
    cardEl.style.visibility = "";
  }
  return (cardEl ?? slot).getBoundingClientRect();
}

function moveStateBoardCard(sourceState, cardId, toIndex) {
  let movedCard = null;
  for (const player of sourceState?.players ?? []) {
    const index = player.board.findIndex(card => card.id === cardId);
    if (index < 0) continue;
    [movedCard] = player.board.splice(index, 1);
    break;
  }
  if (!movedCard || !sourceState.players?.[toIndex]) return null;
  sourceState.players[toIndex].board.push(movedCard);
  return movedCard;
}

async function animateMindbugSteal(card, sourceRect, { sound = "mindbug" } = {}) {
  playSoundEffect(sound);
  if (!sourceRect) {
    suppressedBoardEnterCardIds.delete(card.id);
    hiddenMindbugTravelCardIds.delete(card.id);
    return;
  }
  await nextAnimationFrame();
  await nextAnimationFrame();
  const targetSlot = findRenderedBoardSlot(card.id);
  const targetCard = findRenderedBoardCard(card.id);
  if (!targetSlot || !targetCard) {
    suppressedBoardEnterCardIds.delete(card.id);
    hiddenMindbugTravelCardIds.delete(card.id);
    return;
  }
  for (const animation of targetSlot.getAnimations({ subtree: true })) {
    animation.cancel();
  }
  targetSlot.style.opacity = "";
  targetSlot.style.transform = "";
  targetCard.style.opacity = "";
  targetCard.style.transform = "";
  const targetRect = targetCard.getBoundingClientRect();
  if (!targetRect) {
    suppressedBoardEnterCardIds.delete(card.id);
    hiddenMindbugTravelCardIds.delete(card.id);
    return;
  }
  targetSlot.style.visibility = "hidden";
  targetCard.style.visibility = "hidden";
  const didAnimate = await animateMindbugStealLayer(targetCard, sourceRect, targetRect);
  if (!targetCard.isConnected) {
    if (targetSlot.isConnected) targetSlot.style.visibility = "";
    suppressedBoardEnterCardIds.delete(card.id);
    hiddenMindbugTravelCardIds.delete(card.id);
    return;
  }
  targetSlot.style.visibility = "";
  targetCard.style.visibility = "";
  targetCard.classList.remove("mindbugTravelHidden");
  suppressedBoardEnterCardIds.delete(card.id);
  hiddenMindbugTravelCardIds.delete(card.id);
  if (!didAnimate) return;
  targetCard.animate([
    { opacity: 0, transform: "scale(var(--board-scale)) scale(.92)" },
    { opacity: 1, transform: "scale(var(--board-scale)) scale(1.06)" },
    { opacity: 1, transform: "scale(var(--board-scale)) scale(1)" }
  ], {
    duration: motionMs(180),
    easing: "cubic-bezier(.2, .8, .2, 1)",
    fill: "both"
  });
}

async function animateMindbugStealLayer(sourceEl, fromViewportRect, toViewportRect) {
  const app = document.querySelector(".app");
  if (!app) return false;
  const layer = document.createElement("div");
  layer.className = "cardTopLayer mindbugStealLayer";
  app.append(layer);
  const layerRect = layer.getBoundingClientRect();
  const fromRect = travelRectToLocal(fromViewportRect, layerRect);
  const toRect = travelRectToLocal(toViewportRect, layerRect);
  const clone = sourceEl.cloneNode(true);
  clone.classList.remove("dimmedCard", "dimmedCardFadeIn", "dimmedCardFadeOut", "mindbugPendingCard", "mindbugTravelHidden", "inspectCardPending");
  clone.classList.add("mindbugStealLayerClone", "animationCard");
  clone.querySelectorAll(".effectTags").forEach(tagEl => tagEl.remove());
  clone.style.visibility = "visible";
  const fromScale = fromRect.width / CARD_BASE_WIDTH;
  const toScale = toRect.width / CARD_BASE_WIDTH;
  clone.style.left = `${fromRect.left}px`;
  clone.style.top = `${fromRect.top}px`;
  clone.style.width = `${CARD_BASE_WIDTH}px`;
  clone.style.height = `${CARD_BASE_HEIGHT}px`;
  clone.style.minWidth = `${CARD_BASE_WIDTH}px`;
  clone.style.minHeight = `${CARD_BASE_HEIGHT}px`;
  clone.style.transform = `scale(${fromScale})`;
  layer.append(clone);
  const travelX = toRect.left - fromRect.left;
  const travelY = toRect.top - fromRect.top;
  const tilt = Math.abs(travelX) > 12
    ? (travelX > 0 ? 7 : -7)
    : (travelY > 0 ? 7 : -7);
  const animation = clone.animate([
    { opacity: 1, transform: `translate3d(0, 0, 0) scale(${fromScale}) rotate(0deg)`, offset: 0 },
    {
      opacity: 1,
      transform: `translate3d(${travelX * 0.28}px, ${travelY * 0.28}px, 0) scale(${fromScale + ((toScale - fromScale) * 0.28)}) rotate(${tilt}deg)`,
      offset: 0.28
    },
    {
      opacity: 1,
      transform: `translate3d(${travelX * 0.82}px, ${travelY * 0.82}px, 0) scale(${fromScale + ((toScale - fromScale) * 0.82)}) rotate(${tilt}deg)`,
      offset: 0.72
    },
    {
      opacity: 1,
      transform: `translate3d(${travelX}px, ${travelY}px, 0) scale(${toScale}) rotate(0deg)`,
      offset: 1
    }
  ], {
    duration: motionMs(520),
    easing: "cubic-bezier(.16,.78,.18,1)",
    fill: "forwards"
  });
  await animation.finished.catch(() => {});
  layer.remove();
  return true;
}

function travelRectToLocal(rect, rootRect) {
  const scale = appScaleFromRect(rootRect);
  return {
    left: (rect.left - rootRect.left) / scale,
    top: (rect.top - rootRect.top) / scale,
    width: rect.width / scale,
    height: rect.height / scale
  };
}

function appScaleFromRect(rootRect) {
  const scale = rootRect?.width ? rootRect.width / APP_DESIGN_WIDTH : 1;
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

async function summonForActive(card) {
  const actorIndex = state.active;
  const actor = currentPlayer();
  actor.board.push(card);
  log(`${actor.name} chơi ${card.name}.`);
  render();
  await resolvePlayAbility(card, actorIndex);
  await waitAfterBotAction(actorIndex);
  endTurn();
}

function waitForDrOrangeChoice(card, actorIndex) {
  return new Promise(resolve => {
    choiceDepth += 1;
    state.phase = "choice";
    state.active = actorIndex;
    drOrangeChoicePrompt = { cardId: card.id, actorIndex, resolve };
    showRemoteMessage("Kích hoạt năng lực?", displayCardName(card), { sticky: true });
    render();
  });
}

function finishDrOrangeChoice(activate) {
  if (!drOrangeChoicePrompt) return;
  const { actorIndex, resolve } = drOrangeChoicePrompt;
  drOrangeChoicePrompt = null;
  if (duelModeActive) {
    render();
    resolve(Boolean(activate));
    return;
  }
  choiceDepth -= 1;
  state.active = actorIndex;
  if (!choiceDepth && !hasWinner()) state.phase = "action";
  clearRemoteMessage();
  render();
  resolve(Boolean(activate));
}

function waitForEarwigChoice(card, actorIndex) {
  return new Promise(resolve => {
    choiceDepth += 1;
    state.phase = "choice";
    state.active = actorIndex;
    earwigChoicePrompt = { cardId: card.id, actorIndex, resolve };
    showRemoteMessage("Kích hoạt năng lực?", displayCardName(card), { sticky: true });
    render();
  });
}

function finishEarwigChoice(activate) {
  if (!earwigChoicePrompt) return;
  const { actorIndex, resolve } = earwigChoicePrompt;
  earwigChoicePrompt = null;
  if (duelModeActive) {
    render();
    resolve(Boolean(activate));
    return;
  }
  choiceDepth -= 1;
  state.active = actorIndex;
  if (!choiceDepth && !hasWinner()) state.phase = "action";
  clearRemoteMessage();
  render();
  resolve(Boolean(activate));
}

function pickUtilityPlayTarget(cards, sourceCard, actorIndex) {
  return new Promise(resolve => {
    choiceDepth += 1;
    state.phase = "choice";
    state.active = actorIndex;
    inspectedLocalBoardCardId = "";
    utilityKeywordSelection = {
      actorIndex,
      sourceCard,
      cardIds: new Set(cards.map(card => card.id)),
      resolve
    };
    showRemoteMessage("Chọn Quái vật để sao chép PLAY ability", "", { sticky: actorIndex === 0 });
    render();
  });
}

function finishUtilityPlaySelection(cardId) {
  if (!utilityKeywordSelection?.cardIds.has(cardId)) return;
  const { actorIndex, resolve } = utilityKeywordSelection;
  utilityKeywordSelection = null;
  inspectedLocalBoardCardId = "";
  choiceDepth -= 1;
  state.active = actorIndex;
  if (!choiceDepth && !hasWinner()) state.phase = "action";
  clearRemoteMessage();
  render();
  resolve(cardId);
}

async function resolvePlayAbility(card, ownerIndex) {
  if (!CREATURE_ABILITIES_ENABLED) return;
  const owner = state.players[ownerIndex];
  const enemy = state.players[1 - ownerIndex];
  if (!canActivatePlay(ownerIndex, card)) {
    log(`${card.name} bị Deathweaver chặn hiệu ứng Khi vào sân.`);
    return;
  }
  if (!PLAY_ABILITY_CARDS.has(card.name)) return;
  announceAbilityActivation(card, ownerIndex, "Chơi");

  switch (card.name) {
    case "Mysterious Mermaid":
      await setLife(owner, enemy.life);
      log(`${card.name}: LP của ${owner.name} bằng ${enemy.life}.`);
      break;
    case "Ferret Bomber":
      await chooseCardsToDiscard(1 - ownerIndex, ownerIndex, card, 2);
      break;
    case "Compost Dragon":
      await playFromDiscard(ownerIndex, owner, card);
      break;
    case "Axolotl Healer":
      await gainLife(owner, 2);
      log(`${owner.name} hồi 2 LP.`);
      break;
    case "Killer Bee":
      await loseLife(enemy, 1, { screenImpact: true });
      log(`${enemy.name} mất 1 LP.`);
      break;
    case "Grave Robber":
      await playFromDiscard(ownerIndex, enemy, card);
      break;
    case "Giraffodile":
      addCardsToHand(ownerIndex, owner.discard.splice(0));
      log(`${owner.name} rút toàn bộ Mộ bài lên tay.`);
      break;
    case "Brain Fly":
      await stealByPower(ownerIndex, 6, Infinity, card);
      break;
    case "Kangasaurus Rex":
      await defeatMatching(enemy.board.filter(c => cardPower(c, 1 - ownerIndex) <= 4), 1 - ownerIndex);
      log(`${card.name} hạ các Quái vật địch có tấn công từ 4 trở xuống.`);
      break;
    case "Tiger Squirrel":
      await defeatOne(ownerIndex, enemy.board.filter(c => cardPower(c, 1 - ownerIndex) >= 7), "Chọn Quái vật địch tấn công 7+ để hạ", true, card);
      break;
    case "Goreagle Alpha":
      await loseLife(owner, 1, { screenImpact: ownerIndex === 0 });
      log(`${owner.name} mất 1 LP bởi ${card.name}.`);
      break;
    case "Hungry Hungry Hamster":
      await receiveCardFromOpponentHand(ownerIndex, card);
      break;
    case "Cheeky Chimpborg":
      await chooseCardsToDiscard(1 - ownerIndex, ownerIndex, card, enemy.board.length);
      break;
    case "Chuckling Chimpborg":
      await loseLife(enemy, enemy.mindbugs, { screenImpact: true });
      break;
    case "Dr. Orange U. Tan": {
      const activate = ownerIndex === 0
        ? await waitForDrOrangeChoice(card, ownerIndex)
        : owner.life > 1 && enemy.board.length - owner.board.length >= 2;
      if (!activate) break;
      await loseLife(owner, 1, { screenImpact: ownerIndex === 0 });
      if (hasWinner()) break;
      const returned = [...enemy.board];
      for (const target of returned) {
        await animateCardReturnToHand(target.id, 1 - ownerIndex);
        const targetIndex = enemy.board.findIndex(boardCard => boardCard.id === target.id);
        if (targetIndex < 0) continue;
        enemy.board.splice(targetIndex, 1);
        target.exhausted = false;
        target.attacksThisTurn = 0;
        target.damage = 0;
        target.originalOwnerIndex = 1 - ownerIndex;
        enemy.hand.push(target);
        if (1 - ownerIndex === BOT_INDEX) opponentHandSlotOffset += 1;
        render();
        await afterNextPaint();
      }
      log(`${card.name}: toàn bộ Quái vật địch trở về tay ${enemy.name}.`);
      render();
      break;
    }
    case "Earwig Assassin": {
      const creaturesInPlay = state.players.flatMap(player => [...player.board]);
      const canActivate = owner.hand.length > 0 && creaturesInPlay.length > 0;
      const activate = canActivate && (
        ownerIndex === 0
          ? await waitForEarwigChoice(card, ownerIndex)
          : bot.chooseOption(
            { type: "earwig", actorIndex: ownerIndex, card },
            state,
            botHelpers()
          ) === "activate"
      );
      if (!activate) break;
      await chooseCardsToDiscard(ownerIndex, ownerIndex, card, 1);
      const candidates = ownerIndex === BOT_INDEX
        ? [...enemy.board]
        : state.players.flatMap(player => [...player.board]);
      if (candidates.length) {
        showRemoteMessage("Chọn Quái vật để giết", "", { sticky: ownerIndex === 0 });
        const pickedId = ownerIndex === 0
          ? await pickDefeatTargetFromBoard(candidates, state.active, null, card, ownerIndex)
          : bot.chooseOption(
            {
              type: "defeat",
              actorIndex: ownerIndex,
              ownerIndex: 1 - ownerIndex,
              cards: candidates,
              sourceCard: card
            },
            state,
            botHelpers()
          );
        clearRemoteMessage();
        const targetOwnerIndex = state.players.findIndex(player => player.board.some(target => target.id === pickedId));
        if (targetOwnerIndex >= 0) await defeatCreature(pickedId, targetOwnerIndex);
      }
      break;
    }
    case "The Experiment": {
      const candidates = [...enemy.board];
      if (!candidates.length) break;
      showRemoteMessage("Chọn Quái vật để cướp", "", { sticky: ownerIndex === 0 });
      const pickedId = ownerIndex === 0
        ? await pickStealTargetFromBoard(candidates, ownerIndex, 1 - ownerIndex, ownerIndex, card)
        : randomItem(candidates).id;
      if (pickedId) {
        const experimentRect = measureBoardSlotRect(card.id);
        const targetRect = measureBoardSlotRect(pickedId);
        const cardIndex = owner.board.findIndex(item => item.id === card.id);
        const targetIndex = enemy.board.findIndex(item => item.id === pickedId);
        if (cardIndex >= 0 && targetIndex >= 0) {
          const [experiment] = owner.board.splice(cardIndex, 1);
          const [target] = enemy.board.splice(targetIndex, 1);
          experiment.exhausted = true;
          target.exhausted = true;
          enemy.board.push(experiment);
          owner.board.push(target);
          for (const moved of [experiment, target]) {
            suppressedBoardEnterCardIds.add(moved.id);
            hiddenMindbugTravelCardIds.add(moved.id);
          }
          render();
          await Promise.all([
            animateMindbugSteal(experiment, experimentRect, { sound: "ability" }),
            animateMindbugSteal(target, targetRect, { sound: "ability" })
          ]);
        }
      }
      clearRemoteMessage();
      break;
    }
    case "Utility Bug": {
      const candidates = state.players.flatMap(player => (
        player.board.filter(target => (
          target.id !== card.id && hasPrintedPlayAbility(target)
        ))
      ));
      if (!candidates.length) {
        log(`${card.name}: không có PLAY ability hợp lệ để sao chép.`);
        showRemoteMessage("Không có mục tiêu", "Hiệu ứng của Utility Bug bị hủy.");
        break;
      }
      const pickedId = ownerIndex === 0
        ? await pickUtilityPlayTarget(candidates, card, ownerIndex)
        : randomItem(candidates).id;
      const picked = state.players.flatMap(player => player.board).find(target => target.id === pickedId);
      if (picked) {
        const copiedAbilityCard = { ...card, name: picked.name, ability: picked.ability };
        await resolvePlayAbility(copiedAbilityCard, ownerIndex);
      }
      break;
    }
    case "Radioactive Rabbit": {
      const sourceRect = measureBoardSlotRect(card.id);
      const cardIndex = owner.board.findIndex(item => item.id === card.id);
      if (cardIndex >= 0) enemy.board.push(owner.board.splice(cardIndex, 1)[0]);
      card.exhausted = true;
      if (sourceRect) {
        suppressedBoardEnterCardIds.add(card.id);
        hiddenMindbugTravelCardIds.add(card.id);
        render();
        await animateMindbugSteal(card, sourceRect, { sound: "ability" });
      }
      break;
    }
    case "Turtle Toaster":
      for (let count = 0; count < 2; count += 1) {
        const targets = enemy.board.filter(target => {
          const power = cardPower(target, 1 - ownerIndex);
          return power >= 4 && power <= 6;
        });
        if (!targets.length) break;
        await defeatOne(ownerIndex, targets, "Chọn Quái vật Power 4–6 để hạ", true, card);
      }
      break;
    default:
      break;
  }
  checkGameOver();
}

function canActivatePlay(ownerIndex, card) {
  const enemy = state.players[1 - ownerIndex];
  return !enemy.board.some(enemyCard => enemyCard.name === "Deathweaver") || card.name === "Deathweaver";
}

function addCardsToHand(playerIndex, cards) {
  if (!cards.length) return;
  markOriginalOwner(cards, playerIndex);
  state.players[playerIndex].hand.push(...cards);
  if (playerIndex === BOT_INDEX) opponentHandSlotOffset -= cards.length;
}

function pickDiscardPileCard(cards, actorIndex, ownerIndex, sourceCard = null) {
  return new Promise(resolve => {
    choiceDepth += 1;
    state.phase = "choice";
    state.active = actorIndex;
    inspectedDiscardPileCardId = "";
    discardPileSelection = {
      actorIndex,
      ownerIndex,
      sourceCard,
      cardIds: new Set(cards.map(card => card.id)),
      resolve
    };
    showRemoteMessage("Chọn Quái vật để hồi sinh", "", { sticky: true });
    openDiscardDialog(ownerIndex);
    render();
  });
}

function finishDiscardPileSelection(cardId) {
  if (!discardPileSelection || !discardPileSelection.cardIds.has(cardId)) return;
  const resolve = discardPileSelection.resolve;
  const actorIndex = discardPileSelection.actorIndex;
  discardPileSelection = null;
  inspectedDiscardPileCardId = "";
  choiceDepth -= 1;
  state.active = actorIndex;
  clearRemoteMessage();
  if (!choiceDepth && !hasWinner()) state.phase = "action";
  closeDiscardDialog({ force: true });
  render();
  resolve(cardId);
}

function sendDuelDiscardPileChoice(cardId) {
  if (!discardPileSelection || !discardPileSelection.cardIds.has(cardId)) return;
  discardPileSelection = null;
  inspectedDiscardPileCardId = "";
  closeInspectDialogInstant();
  closeDiscardDialog({ force: true });
  render();
  sendDuelAction({ type: "discard-pile-choice", cardId });
}

function cancelDiscardPileSelection() {
  if (!discardPileSelection) return;
  const resolve = discardPileSelection.resolve;
  const actorIndex = discardPileSelection.actorIndex;
  discardPileSelection = null;
  inspectedDiscardPileCardId = "";
  choiceDepth -= 1;
  state.active = actorIndex;
  clearRemoteMessage();
  if (!choiceDepth && !hasWinner()) state.phase = "action";
  render();
  resolve("");
}

async function playFromDiscard(ownerIndex, sourcePlayer, sourceCard = null) {
  if (!sourcePlayer.discard.length) {
    log("Không có lá trong Mộ bài để chơi.");
    return;
  }
  const sourceOwnerIndex = state.players.indexOf(sourcePlayer);
  const pickedId = ownerIndex === 0
    ? await pickDiscardPileCard(sourcePlayer.discard, ownerIndex, sourceOwnerIndex, sourceCard)
    : await pickCard(sourcePlayer.discard, "Chọn Quái vật để hồi sinh", false, { actorIndex: ownerIndex, ownerIndex: sourceOwnerIndex });
  if (!pickedId) return;
  const index = sourcePlayer.discard.findIndex(card => card.id === pickedId);
  const [card] = sourcePlayer.discard.splice(index, 1);
  // Mindbug chỉ áp dụng khi một lá được chơi trực tiếp từ tay xuống bàn.
  state.players[ownerIndex].board.push(card);
  log(`${state.players[ownerIndex].name} chơi ${card.name} từ Mộ bài.`);
  await resolvePlayAbility(card, ownerIndex);
}

async function receiveCardFromOpponentHand(ownerIndex, sourceCard) {
  const giverIndex = 1 - ownerIndex;
  const giver = state.players[giverIndex];
  const receiver = state.players[ownerIndex];
  if (!giver.hand.length) {
    log(`${giver.name} không có bài trên tay để đưa.`);
    return;
  }
  showRemoteMessage("Chọn 1 lá trên tay để đưa", "", { sticky: giverIndex === 0 });
  const pickedId = giverIndex === 0
    ? await pickDiscardFromHand(giverIndex, ownerIndex, sourceCard, "Đưa")
    : await pickCard(giver.hand, `${giver.name}: chọn 1 lá đưa cho ${displayCardName(sourceCard)}`, false, { actorIndex: giverIndex, ownerIndex: giverIndex });
  clearRemoteMessage();
  if (!pickedId) return;
  const index = giver.hand.findIndex(card => card.id === pickedId);
  if (index < 0) return;
  const [card] = giver.hand.splice(index, 1);
  receiver.hand.push(card);
  if (ownerIndex === BOT_INDEX) opponentHandSlotOffset -= 1;
  if (giverIndex === BOT_INDEX) opponentHandSlotOffset += 1;
  log(`${giver.name} đưa ${card.name} cho ${receiver.name}.`);
  drawToFive(giver);
  await chooseReceivedCardOutcome(ownerIndex, card, sourceCard);
  render();
}

function canUseEvolutionAction(card, ownerIndex) {
  if (animationTestMode || !CREATURE_ABILITIES_ENABLED) return false;
  if (!card || state.phase !== "action" || state.active !== ownerIndex || hasWinner()) return false;
  if (card.exhausted) return false;
  if (state.frenzyOnly && state.frenzyOnly !== card.id) return false;
  if (card.attacksThisTurn > 0) return false;
  if (captainHippoForcedAttackers(ownerIndex).length) return false;
  return ACTION_ABILITY_CARDS.has(card.name);
}

async function useEvolutionAction(cardId, ownerIndex) {
  const player = state.players[ownerIndex];
  const card = player.board.find(item => item.id === cardId);
  if (!card || !canUseEvolutionAction(card, ownerIndex)) return;
  if (!duelModeActive && !animationTestMode) {
    bot.recordGameAction(state, { type: "action", cardId }, ownerIndex);
  }
  clearRemoteMessageForAction();
  announceAbilityActivation(card, ownerIndex, "Khi Được tưới");
  setOpponentAbilityMessage(card, displayAbility(card));
  await playWaterdropActionFx(card.id);
  await resolveEvolutionActionAbility(card, ownerIndex);
  if (EVOLUTION_INFO[card.name]?.evolution) await evolveBoardCreature(card.id, ownerIndex);
  render();
  await waitAfterBotAction(ownerIndex);
  endTurn();
}

async function resolveEvolutionActionAbility(card, ownerIndex) {
  const enemyIndex = 1 - ownerIndex;
  const enemy = state.players[enemyIndex];
  if (card.name === "Cake Trickster") {
    const candidates = [...enemy.board];
    if (!candidates.length) return;
    showRemoteMessage("Chọn Quái vật địch để ép tấn công", "", { sticky: ownerIndex === 0 });
    const botLethalCountDraculeech = ownerIndex === BOT_INDEX && enemy.life <= 1
      ? candidates.find(target => target.name === "Count Draculeech" && canAttack(target, enemyIndex))
      : null;
    const pickedId = ownerIndex === 0
      ? await pickDefeatTargetFromBoard(candidates, ownerIndex, enemyIndex, card, ownerIndex)
      : (botLethalCountDraculeech?.id ?? randomItem(candidates)?.id ?? "");
    clearRemoteMessage();
    if (!pickedId) return;
    const forcedAttacker = enemy.board.find(target => target.id === pickedId);
    if (forcedAttacker) forcedAttacker.cakeForcedAttack = true;
    if (!canAttack(forcedAttacker, enemyIndex)) {
      if (forcedAttacker) delete forcedAttacker.cakeForcedAttack;
      const message = `${displayCardName(forcedAttacker)} bị hiệu ứng khác ngăn tấn công. Hiệu ứng của ${displayCardName(card)} bị hủy.`;
      log(message);
      showRemoteMessage("Không thể ép tấn công", message);
      return;
    }
    state.active = enemyIndex;
    state.phase = "action";
    let forcedAttackResult = null;
    do {
      forcedAttackResult = await attack(pickedId);
    } while (forcedAttackResult?.retryCakeAttack && !hasWinner());
    delete forcedAttacker.cakeForcedAttack;
    state.active = ownerIndex;
    if (!hasWinner()) state.phase = "action";
    return;
  }
  if (card.name === "Dragon Inn") {
    if (state.players[ownerIndex].board.length < enemy.board.length) {
      await loseLife(enemy, 1, { screenImpact: enemyIndex === 0 });
      log(`${enemy.name} mất 1 LP bởi ${card.name}.`);
    }
    return;
  }
  if (card.name === "Infernostrich") {
    const candidates = enemy.board.filter(target => cardPower(target, enemyIndex) >= 7);
    if (candidates.length) await defeatOne(ownerIndex, candidates, "Chọn Quái vật sức mạnh 7+ để hạ", false, card);
    return;
  }
  if (card.name === "Octocopter") {
    await defeatCreature(card.id, ownerIndex);
    await stealByPower(ownerIndex, -Infinity, Infinity, card);
    return;
  }
  if (card.name === "Cloud Lady") {
    const candidates = enemy.board.filter(target => cardPower(target, enemyIndex) <= 4);
    if (candidates.length) await defeatOne(ownerIndex, candidates, "Chọn Quái vật để hạ", true, card);
    return;
  }
  if (card.name === "Typhoon Princess") {
    const candidates = enemy.board.filter(target => cardPower(target, enemyIndex) <= 6);
    if (candidates.length) await defeatOne(ownerIndex, candidates, "Chọn Quái vật để hạ", true, card);
    return;
  }
  if (card.name === "Curious Tadpole" || card.name === "Frog Prophet") {
    await gainLife(state.players[ownerIndex], 1);
    return;
  }
  if (card.name === "Waddling Recruit" || card.name === "Veteran Penguin") {
    await chooseCardsToDiscard(enemyIndex, ownerIndex, card, 1);
  }
}

async function evolveBoardCreature(cardId, ownerIndex) {
  const player = state.players[ownerIndex];
  const index = player.board.findIndex(card => card.id === cardId);
  if (index < 0) return null;
  const current = player.board[index];
  const nextName = EVOLUTION_INFO[current.name]?.evolution;
  if (!nextName) return null;
  const extraIndex = player.extraDeck.findIndex(card => card.name === nextName);
  const next = extraIndex >= 0
    ? player.extraDeck.splice(extraIndex, 1)[0]
    : makeEvolutionExtraCard(nextName, ownerIndex);
  if (!next) return null;
  current.exhausted = false;
  current.attacksThisTurn = 0;
  current.damage = 0;
  current.highestEvolutionName = next.name;
  player.evolutionArchive.push(current);
  next.originalOwnerIndex = originalOwnerIndex(current, ownerIndex);
  next.evolutionChainId = current.evolutionChainId || current.id;
  next.evolvedFromNames = [...(current.evolvedFromNames ?? []), current.name];
  next.highestEvolutionName = next.name;
  next.exhausted = true;
  next.attacksThisTurn = 0;
  next.damage = 0;
  await animateEvolutionFlip(current, next, ownerIndex);
  hiddenEvolutionCardIds.add(next.id);
  suppressedBoardEnterCardIds.add(next.id);
  player.board[index] = next;
  log(`${displayCardName(current)} tiến hóa thành ${displayCardName(next)}.`);
  render();
  await afterNextPaint();
  hiddenEvolutionCardIds.delete(next.id);
  suppressedBoardEnterCardIds.delete(next.id);
  return next;
}

function makeEvolutionExtraCard(cardName, ownerIndex) {
  const spec = EXTRA_CARD_SPECS.find(([name]) => name === cardName);
  if (!spec) return null;
  const card = makeCard(spec);
  card.originalOwnerIndex = ownerIndex;
  return card;
}

async function playWaterdropActionFx(cardId) {
  const cardEl = findRenderedBoardCard(cardId);
  const app = document.querySelector(".app");
  if (!cardEl || !app) return;
  const appRect = app.getBoundingClientRect();
  const cardRect = rectToLocal(cardEl.getBoundingClientRect(), appRect);
  if (!cardRect.width || !cardRect.height) return;
  playSoundEffect("waterdrop");
  const layer = document.createElement("div");
  layer.className = "cardTopLayer waterdropFxLayer";
  const sprite = document.createElement("img");
  sprite.className = "waterdropFxSprite";
  sprite.alt = "";
  sprite.draggable = false;
  const fxSize = Math.max(cardRect.width * 0.92, 44);
  sprite.style.left = `${cardRect.left + cardRect.width * 0.64 - fxSize / 2}px`;
  sprite.style.top = `${cardRect.top - cardRect.height * 0.08}px`;
  sprite.style.width = `${fxSize}px`;
  sprite.style.height = `${fxSize}px`;
  sprite.src = WATERDROP_FX_FRAMES[0];
  layer.append(sprite);
  app.append(layer);
  const frameMs = motionMs(86);
  WATERDROP_FX_FRAMES.forEach((frame, index) => {
    window.setTimeout(() => {
      if (sprite.isConnected) sprite.src = frame;
    }, frameMs * index);
  });
  const fade = sprite.animate([
    { opacity: 0, transform: "translate3d(0, -8px, 0) scale(.92)", offset: 0 },
    { opacity: 1, transform: "translate3d(0, 0, 0) scale(1.1)", offset: 0.16 },
    { opacity: 1, transform: "translate3d(0, 3px, 0) scale(1)", offset: 0.78 },
    { opacity: 0, transform: "translate3d(0, 7px, 0) scale(.96)", offset: 1 }
  ], {
    duration: Math.max(motionMs(820), frameMs * WATERDROP_FX_FRAMES.length),
    easing: "steps(2, end)",
    fill: "forwards"
  });
  await fade.finished.catch(() => {});
  layer.remove();
}

async function animateEvolutionFlip(fromCard, toCard, ownerIndex) {
  const source = els.arena?.querySelector(`.fieldCards [data-card-id="${fromCard.id}"]`);
  const app = document.querySelector(".app");
  if (!source || !app) return;
  const appRect = app.getBoundingClientRect();
  const sourceRect = rectToLocal(source.getBoundingClientRect(), appRect);
  if (!sourceRect.width || !sourceRect.height) return;
  hiddenEvolutionCardIds.add(fromCard.id);
  setCardAnimationState(CARD_ANIMATION_STATE.EVOLVING, fromCard.id, { ownerIndex });
  render();
  await afterNextPaint();

  const layer = document.createElement("div");
  layer.className = "cardTopLayer evolutionFlipLayer";
  const shell = document.createElement("div");
  shell.className = "evolutionFlipShell";
  shell.style.left = `${sourceRect.left - ((CARD_BASE_WIDTH - sourceRect.width) / 2)}px`;
  shell.style.top = `${sourceRect.top - ((CARD_BASE_HEIGHT - sourceRect.height) / 2)}px`;
  shell.style.width = `${CARD_BASE_WIDTH}px`;
  shell.style.height = `${CARD_BASE_HEIGHT}px`;
  shell.style.setProperty("--evolution-scale", (sourceRect.width / CARD_BASE_WIDTH).toFixed(4));

  const flipper = document.createElement("div");
  flipper.className = "evolutionFlipCard";
  const front = renderEvolutionFlipFace(fromCard, ownerIndex, "evolutionFlipFront");
  const back = renderEvolutionFlipFace(toCard, ownerIndex, "evolutionFlipBack");
  flipper.append(front, back);
  shell.append(flipper);
  layer.append(shell);
  app.append(layer);
  await afterNextPaint();

  playSoundEffect("evolve");
  shell.classList.add("evolutionCharging");
  const shellAnimation = shell.animate([
    { transform: "translate3d(0, 0, 0) scale(var(--evolution-scale)) rotate(0deg)", offset: 0 },
    { transform: "translate3d(-2px, 1px, 0) scale(calc(var(--evolution-scale) * 1.2)) rotate(-2deg)", offset: 0.16 },
    { transform: "translate3d(3px, -2px, 0) scale(calc(var(--evolution-scale) * 1.34)) rotate(2.5deg)", offset: 0.32 },
    { transform: "translate3d(-2px, 2px, 0) scale(calc(var(--evolution-scale) * 1.36)) rotate(-1.8deg)", offset: 0.46 },
    { transform: "translate3d(2px, -1px, 0) scale(calc(var(--evolution-scale) * 1.35)) rotate(1.6deg)", offset: 0.58 },
    { transform: "translate3d(-2px, -1px, 0) scale(calc(var(--evolution-scale) * 1.26)) rotate(-1.4deg)", offset: 0.72 },
    { transform: "translate3d(2px, 2px, 0) scale(calc(var(--evolution-scale) * 1.1)) rotate(1deg)", offset: 0.86 },
    { transform: "translate3d(0, 0, 0) scale(var(--evolution-scale)) rotate(0deg)", offset: 1 }
  ], {
    duration: motionMs(1120),
    easing: "cubic-bezier(.12, .88, .28, 1)",
    fill: "forwards"
  });
  const flipAnimation = flipper.animate([
    { transform: "rotateY(0deg)", offset: 0 },
    { transform: "rotateY(186deg)", offset: 0.32 },
    { transform: "rotateY(276deg)", offset: 0.5 },
    { transform: "rotateY(354deg)", offset: 0.64 },
    { transform: "rotateY(540deg)", offset: 1 }
  ], {
    duration: motionMs(1120),
    easing: "cubic-bezier(.12, .88, .28, 1)",
    fill: "forwards"
  });
  await Promise.allSettled([shellAnimation.finished, flipAnimation.finished]);
  shell.classList.remove("evolutionCharging");
  layer.remove();
  clearCardAnimationState(CARD_ANIMATION_STATE.EVOLVING, fromCard.id);
  hiddenEvolutionCardIds.delete(fromCard.id);
}

function renderEvolutionFlipFace(card, ownerIndex, className) {
  const face = document.createElement("article");
  face.className = `card evolutionFlipFace ${className}`;
  face.dataset.cardId = card.id;
  applyCardSprite(face, card);
  face.innerHTML = cardFaceHtml(card, cardPower(card, ownerIndex), cardKeywords(card, ownerIndex), "board", ownerIndex);
  return face;
}

function shouldAutoPlayReceivedCard(playerIndex, card) {
  const power = cardPower(card, playerIndex);
  const hasPlayAbility = PLAY_ABILITY_CARDS.has(card.name) && canActivatePlay(playerIndex, card);
  return hasPlayAbility || power >= 4 || state.players[playerIndex].board.length < 2;
}

function waitForReceivedCardChoice(ownerIndex, card, sourceCard) {
  return new Promise(resolve => {
    choiceDepth += 1;
    state.phase = "choice";
    state.active = ownerIndex;
    receivedCardChoicePrompt = { actorIndex: ownerIndex, ownerIndex, cardId: card.id, card, sourceCard, resolve };
    showRemoteMessage("Chơi hay giữ?", displayCardName(card), { sticky: true });
    ensureReceivedCardInspectOverlay(card, ownerIndex);
    render();
  });
}

async function resolveReceivedCardChoicePrompt(choice) {
  if (!receivedCardChoicePrompt) return;
  const prompt = receivedCardChoicePrompt;
  receivedCardChoicePrompt = null;
  choiceDepth -= 1;
  state.active = prompt.actorIndex;
  clearRemoteMessage();
  await closeInspectDialogWithAnimation();
  if (choice === "keep") {
    clearReceivedCardOverlayState({ reveal: true });
  } else {
    clearReceivedCardOverlayState({ reveal: false });
  }
  if (!choiceDepth && !hasWinner()) state.phase = "action";
  render();
  prompt.resolve(choice);
}

async function chooseReceivedCardOutcome(ownerIndex, card, sourceCard) {
  const receiver = state.players[ownerIndex];
  const choice = ownerIndex === 0
    ? await waitForReceivedCardChoice(ownerIndex, card, sourceCard)
    : (shouldAutoPlayReceivedCard(ownerIndex, card) ? "play" : "keep");
  if (choice !== "play") {
    log(`${receiver.name} giữ ${card.name} trên tay.`);
    return;
  }
  const index = receiver.hand.findIndex(handCard => handCard.id === card.id);
  if (index < 0) return;
  const [playedCard] = receiver.hand.splice(index, 1);
  receiver.board.push(playedCard);
  if (ownerIndex === BOT_INDEX) opponentHandSlotOffset += 1;
  log(`${receiver.name} chơi ${playedCard.name} vừa được đưa.`);
  await resolvePlayAbility(playedCard, ownerIndex);
}

async function markCreatureCannotBlock(ownerIndex, candidates, sourceCard) {
  if (!candidates.length) return;
  showRemoteMessage("Chọn Quái vật không thể chặn", "", { sticky: ownerIndex === 0 });
  const enemyIndex = 1 - ownerIndex;
  const pickedId = ownerIndex === 0
    ? await pickDefeatTargetFromBoard(candidates, state.active, enemyIndex, sourceCard, ownerIndex)
    : await pickCard(candidates, `${displayCardName(sourceCard)}: chọn Quái vật không thể chặn`, false, { actorIndex: ownerIndex, ownerIndex: enemyIndex });
  clearRemoteMessage();
  const target = state.players[enemyIndex].board.find(card => card.id === pickedId);
  if (!target) return;
  target.cannotBlockThisTurn = true;
  log(`${target.name} không thể chặn trong lượt này.`);
  render();
}

async function stealSmallCreatures(ownerIndex, limit, sourceCard = null) {
  for (let i = 0; i < limit; i += 1) {
    const enemyIndex = 1 - ownerIndex;
    const candidates = state.players[enemyIndex].board.filter(c => cardPower(c, enemyIndex) <= 5);
    if (!candidates.length) return;
    const stepText = limit > 1 ? ` (${i}/${limit})` : "";
    showRemoteMessage("Chọn Quái vật", stepText.trim(), { sticky: ownerIndex === 0 });
    const pickedId = ownerIndex === 0
      ? await pickStealTargetFromBoard(candidates, state.active, enemyIndex, ownerIndex, sourceCard, true)
      : await pickCard(candidates, `Mẹ Harpy: chọn Quái vật tấn công 5- để cướp${stepText}`, true, { actorIndex: ownerIndex, ownerIndex: enemyIndex });
    if (!pickedId) {
      clearRemoteMessage();
      return;
    }
    moveCreature(pickedId, enemyIndex, ownerIndex);
  }
  clearRemoteMessage();
}

async function stealByPower(ownerIndex, min, max, sourceCard = null) {
  const enemyIndex = 1 - ownerIndex;
  const candidates = state.players[enemyIndex].board.filter(c => {
    const power = cardPower(c, enemyIndex);
    return power >= min && power <= max;
  });
  if (!candidates.length) return;
  showRemoteMessage("Chọn Quái vật", "", { sticky: ownerIndex === 0 });
  const pickedId = ownerIndex === 0
    ? await pickStealTargetFromBoard(candidates, state.active, enemyIndex, ownerIndex, sourceCard)
    : await pickCard(candidates, "Chọn Quái vật để cướp", true, { actorIndex: ownerIndex, ownerIndex: enemyIndex });
  if (pickedId) moveCreature(pickedId, enemyIndex, ownerIndex);
  clearRemoteMessage();
}

function pickStealTargetFromBoard(candidates, turnOwnerIndex, targetOwnerIndex, actorIndex, sourceCard = null, allowSkip = false) {
  return new Promise(resolve => {
    choiceDepth += 1;
    state.phase = "choice";
    state.active = actorIndex;
    inspectedLocalBoardCardId = "";
    stealSelection = {
      turnOwnerIndex,
      actorIndex,
      ownerIndex: targetOwnerIndex,
      sourceCard,
      cardIds: new Set(candidates.map(card => card.id)),
      allowSkip,
      resolve
    };
    render();
  });
}

function finishStealSelection(cardId) {
  if (!stealSelection || !stealSelection.cardIds.has(cardId)) return;
  const resolve = stealSelection.resolve;
  const turnOwnerIndex = stealSelection.turnOwnerIndex;
  stealSelection = null;
  inspectedLocalBoardCardId = "";
  choiceDepth -= 1;
  state.active = turnOwnerIndex;
  clearRemoteMessage();
  if (!choiceDepth && !hasWinner()) state.phase = "action";
  render();
  resolve(cardId);
}

function cancelStealSelection() {
  if (!stealSelection?.allowSkip) return;
  const resolve = stealSelection.resolve;
  const turnOwnerIndex = stealSelection.turnOwnerIndex;
  stealSelection = null;
  inspectedLocalBoardCardId = "";
  choiceDepth -= 1;
  state.active = turnOwnerIndex;
  clearRemoteMessage();
  if (!choiceDepth && !hasWinner()) state.phase = "action";
  render();
  resolve("");
}

function moveCreature(cardId, fromIndex, toIndex) {
  const from = state.players[fromIndex];
  const to = state.players[toIndex];
  const index = from.board.findIndex(card => card.id === cardId);
  if (index < 0) return;
  const [card] = from.board.splice(index, 1);
  card.exhausted = true;
  to.board.push(card);
  log(`${to.name} cướp ${card.name}.`);
}

async function attack(cardId) {
  if (state.phase !== "action" || hasWinner()) return;
  const randomPlan = debugRandomAttackPlan?.attackerId === cardId ? debugRandomAttackPlan : null;
  const attackerIndex = state.active;
  const defenderIndex = 1 - state.active;
  const attacker = currentPlayer().board.find(card => card.id === cardId);
  if (!attacker || !canAttack(attacker, attackerIndex)) return;
  if (!duelModeActive && !animationTestMode) {
    bot.recordGameAction(state, { type: "attack", cardId }, attackerIndex);
  }
  clearRemoteMessageForAction();
  const isFrenzySecondAttack = canAttackAgain(attacker, attackerIndex);
  state.frenzyOnly = null;
  const initialAttackerKeywords = cardKeywords(attacker, attackerIndex);
  let attackIntentEntered = isCardAnimationState(attacker.id, CARD_ANIMATION_STATE.ATTACK_INTENT);
  if (!attackIntentEntered && !randomPlan && attackerIndex === 0 && initialAttackerKeywords.includes("HUNTER")) {
    await enterAttackIntent(attacker.id, attackerIndex);
    attackIntentEntered = true;
  }

  await resolveAttackAbility(attacker, attackerIndex);
  checkGameOver();
  if (hasWinner()) {
    if (randomPlan) debugRandomAttackPlan = null;
    render();
    return;
  }
  if (!currentPlayer().board.some(card => card.id === attacker.id)) {
    if (randomPlan) debugRandomAttackPlan = null;
    if (attackIntentEntered) await exitAttackIntent(attacker.id, attackerIndex);
    await waitAfterBotAction(attackerIndex);
    endTurn();
    return;
  }

  const attackerKeywords = cardKeywords(attacker, attackerIndex);
  let targetCreature = null;
  if (randomPlan?.targetCreatureId) {
    targetCreature = opponentPlayer().board.find(card => card.id === randomPlan.targetCreatureId) ?? null;
  } else if (!randomPlan && attackerKeywords.includes("HUNTER") && opponentPlayer().board.length) {
    const captains = attacker.cakeForcedAttack
      ? []
      : opponentPlayer().board.filter(card => card.name === "Captain Hippo");
    const hunterTargets = captains.length ? captains : opponentPlayer().board;
    const hunterChoice = captains.length
      ? "creature"
      : attackerIndex === 0
        ? await waitForHunterAttackPrompt(attacker, attackerIndex, defenderIndex)
        : "creature";
    if (hunterChoice === "creature") {
      const picked = attackerIndex === 0
        ? await pickHunterTargetFromBoard(hunterTargets, attackerIndex, defenderIndex, attacker)
        : randomItem(hunterTargets).id;
      if (picked) targetCreature = opponentPlayer().board.find(card => card.id === picked);
    }
  }

    if (targetCreature) {
      if (randomPlan) debugRandomAttackPlan = null;
      const attackIntentRotate = attackIntentEntered
        ? await finishAttackIntentForCreature(attacker.id, attackerIndex, targetCreature.id)
        : "";
      await animateAttackCreature(attacker.id, targetCreature.id, attackIntentRotate);
      await resolvePendingFrostyDrawToFive();
      await combat(attacker, targetCreature, attackerIndex, defenderIndex);
    } else {
    if (!attackIntentEntered) await enterAttackIntent(attacker.id, attackerIndex);
    const blockers = legalBlockers(attacker, attackerIndex, defenderIndex);
    let blocker = null;
    if (blockers.length) {
      const picked = animationTestMode
        ? randomItem(blockers).id
        : (randomPlan
          ? randomPlan.blockerId
          : defenderIndex === 0
            ? await chooseLocalBlocker(blockers, attacker, attackerIndex, defenderIndex, isFrenzySecondAttack)
            : await pickCard(blockers, `${opponentPlayer().name}: chọn Quái vật chặn hoặc bỏ qua${isFrenzySecondAttack ? " lần hai" : ""}`, true, { type: "block", actorIndex: defenderIndex, attacker, ownerIndex: defenderIndex, isFrenzySecondAttack }));
      if (picked) {
        blocker = opponentPlayer().board.find(card => card.id === picked);
        if (blocker) trackDebugTargetCard(blocker.id, displayCardName(blocker));
      }
    }
    if (randomPlan) debugRandomAttackPlan = null;
    if (blocker) {
      const attackIntentRotate = await finishAttackIntentForCreature(attacker.id, attackerIndex, blocker.id);
      await animateAttackCreature(attacker.id, blocker.id, attackIntentRotate);
      await resolvePendingFrostyDrawToFive();
      await combat(attacker, blocker, attackerIndex, defenderIndex);
    } else {
      await resolveAttackIntentFace(attacker.id, attackerIndex, () => loseLife(opponentPlayer(), 1, { scoreboardOnly: true }));
      await resolvePendingFrostyDrawToFive();
      log(`${attacker.name} tấn công trực tiếp. ${opponentPlayer().name} mất 1 LP.`);
    }
  }

  if (attacker.deferredAttackLifeEffect && !hasWinner()) {
    const effect = attacker.deferredAttackLifeEffect;
    attacker.deferredAttackLifeEffect = "";
    if (effect === "set-enemy-to-one" && state.players[defenderIndex].life > 1) {
      await setLife(state.players[defenderIndex], 1);
      log(`${state.players[defenderIndex].name} còn 1 LP.`);
    }
    if (effect === "enemy-loses-one") {
      await loseLife(state.players[defenderIndex], 1, { screenImpact: defenderIndex === 0 });
      log(`${state.players[defenderIndex].name} mất 1 LP bởi ${attacker.name}.`);
    }
  }
  if (attacker.countLifeLossAfterAttack && !hasWinner()) {
    attacker.countLifeLossAfterAttack = false;
    await loseLife(state.players[attackerIndex], 1, { screenImpact: attackerIndex === 0 });
    log(`${state.players[attackerIndex].name} mất 1 LP bởi ${attacker.name}.`);
  }
  const attackerStillHere = currentPlayer().board.some(card => card.id === attacker.id);
  if (attackerStillHere && !animationTestMode) attacker.attacksThisTurn += 1;
  const canFrenzy = attackerStillHere && canAttackAgain(attacker, attackerIndex);
  checkGameOver();
  if (hasWinner()) return;
  if (canFrenzy) {
    const choice = attackerIndex === 0
      ? await waitForFrenzySecondAttack(attacker, attackerIndex)
      : "again";
    if (choice === "again") {
      state.frenzyOnly = attacker.id;
      log(`${attacker.name} sẵn sàng tấn công lần hai.`);
      if (attackerIndex === 0) {
        state.phase = "action";
        render();
        await attack(attacker.id);
      } else {
        render();
        scheduleBotTurn();
      }
      return;
    }
    if (attackerIndex === 0) await exitAttackIntent(attacker.id, attackerIndex);
  }
  if (attackerStillHere && !animationTestMode) attacker.exhausted = true;
  if (animationTestMode) {
    render();
    return;
  }
  await waitAfterBotAction(attackerIndex);
  endTurn();
}

async function resolveAttackAbility(card, ownerIndex) {
  if (animationTestMode) return;
  if (!CREATURE_ABILITIES_ENABLED) return;
  if (!ATTACK_ABILITY_CARDS.has(card.name)) return;
  const enemy = state.players[1 - ownerIndex];
  announceAbilityActivation(card, ownerIndex, "Tấn công");
  setOpponentAbilityMessage(card, displayAbility(card));
  switch (card.name) {
    case "Shark Dog":
      await defeatOne(ownerIndex, enemy.board.filter(c => cardPower(c, 1 - ownerIndex) >= 6), "Chó Cá Mập: chọn Quái vật địch tấn công 6+ để hạ", false, card);
      break;
    case "Snail Hydra":
      if (state.players[ownerIndex].board.length < enemy.board.length) {
        await defeatOne(ownerIndex, enemy.board, "Ốc Sên Hydra: chọn quái vật để hạ", true, card);
      }
      break;
    case "Turbo Bug":
      card.deferredAttackLifeEffect = "set-enemy-to-one";
      break;
    case "Chameleon Sniper":
      card.deferredAttackLifeEffect = "enemy-loses-one";
      break;
    case "Tusked Exporter":
      await chooseCardsToDiscard(1 - ownerIndex, ownerIndex, card, 1);
      break;
    case "Count Draculeech": {
      card.countLifeLossAfterAttack = true;
      const candidates = state.players.flatMap(player => [...player.board]);
      showRemoteMessage("Chọn Quái vật để giết", "", { sticky: ownerIndex === 0 });
      const pickedId = ownerIndex === 0
        ? await pickDefeatTargetFromBoard(candidates, state.active, null, card, ownerIndex)
        : randomItem(candidates)?.id;
      clearRemoteMessage();
      const targetOwnerIndex = state.players.findIndex(player => player.board.some(target => target.id === pickedId));
      if (targetOwnerIndex >= 0) await defeatCreature(pickedId, targetOwnerIndex);
      break;
    }
    case "Majestic Manticore": {
      const creaturesInPlay = state.players.flatMap((player, targetOwnerIndex) => (
        player.board.map(target => ({
          id: target.id,
          ownerIndex: targetOwnerIndex,
          power: cardPower(target, targetOwnerIndex)
        }))
      ));
      const lowestPower = Math.min(...creaturesInPlay.map(target => target.power));
      const lowestCreatures = creaturesInPlay.filter(target => target.power === lowestPower);
      for (const target of lowestCreatures) {
        const currentOwnerIndex = state.players.findIndex(player => player.board.some(boardCard => boardCard.id === target.id));
        if (currentOwnerIndex >= 0) await defeatCreature(target.id, currentOwnerIndex);
      }
      log(`${card.name} hạ các Quái vật có tấn công thấp nhất trên toàn bộ sân.`);
      break;
    }
    case "The Lurker":
      if (state.players[ownerIndex].board.length > enemy.board.length) {
        card.lurkerSneakyThisTurn = true;
        log(`${card.name} có TÀNG HÌNH trong lượt này.`);
        showRemoteMessage(displayCardName(card), "Có TÀNG HÌNH lượt này", { cardName: displayCardName(card) });
        render();
        await wait(motionMs(520));
      }
      break;
    case "Turf The Surfer":
      await markCreatureCannotBlock(ownerIndex, enemy.board, card);
      break;
    case "Thunder Queen":
      await defeatOne(ownerIndex, enemy.board, "Chọn Quái vật để hạ", false, card);
      break;
    case "World Eater":
      card.deferredAttackLifeEffect = "enemy-loses-one";
      break;
    case "Frosty Fortress":
      await discardWholeHandAndDeck(1 - ownerIndex);
      break;
    case "Blastfish":
      card.cannotBeDefeatedThisTurn = true;
      break;
    case "Bullet Train":
      await defeatOne(ownerIndex, enemy.board.filter(target => cardPower(target, 1 - ownerIndex) <= 3), "Chọn Quái vật Power 3 trở xuống để hạ", false, card);
      break;
    default:
      break;
  }
}

async function discardWholeHandAndDeck(playerIndex, payload = null) {
  const player = state.players[playerIndex];
  if (!player) return;
  const handCards = payload?.handCards ?? [...player.hand];
  const deckCards = payload?.deckCards ?? [];
  await animateFrostyDiscardAll(playerIndex, handCards, deckCards);
  log(`${player.name} bỏ toàn bộ bài trên tay.`);
  if (!payload) {
    pendingFrostyDrawToFivePlayerIndex = playerIndex;
  }
}

async function resolvePendingFrostyDrawToFive() {
  if (pendingFrostyDrawToFivePlayerIndex === null || pendingFrostyDrawToFivePlayerIndex === undefined) return;
  const playerIndex = pendingFrostyDrawToFivePlayerIndex;
  pendingFrostyDrawToFivePlayerIndex = null;
  const player = state.players[playerIndex];
  if (!player) return;
  const drawn = drawToFive(player);
  if (drawn > 0) log(`${player.name} rút ${drawn} lá để đủ 5 lá sau khi bỏ bài.`);
  render();
  await wait(motionMs(120));
}

async function animateFrostyDiscardAll(playerIndex, handCards = [], deckCards = []) {
  for (const card of handCards) {
    await animateFrostyDiscardCard(playerIndex, card, "hand");
  }
  for (const card of deckCards) {
    await animateFrostyDiscardCard(playerIndex, card, "deck");
  }
}

async function animateFrostyDiscardCard(playerIndex, card, zone) {
  const player = state.players[playerIndex];
  if (!player || !card) return;
  render();
  await afterNextPaint();
  const sourceRect = zone === "deck"
    ? measureDeckPileCardRect(playerIndex)
    : measureFrostyHandCardRect(playerIndex, card.id);
  const clone = createFrostyDiscardClone(playerIndex, card, zone, sourceRect);
  playSoundEffect("draw");
  const distance = zone === "hand" ? 82 : (playerIndex === BOT_INDEX ? 64 : -64);
  const rotate = zone === "hand" ? 4 : (playerIndex === BOT_INDEX ? -6 : 6);
  if (clone) {
    const animation = clone.animate([
      { opacity: 1, transform: "translate3d(0, 0, 0) rotate(0deg)", offset: 0 },
      { opacity: 1, transform: `translate3d(0, ${distance * 0.62}px, 0) rotate(${rotate * 0.5}deg)`, offset: 0.68 },
      { opacity: 0, transform: `translate3d(0, ${distance}px, 0) rotate(${rotate}deg)`, offset: 1 }
    ], {
      duration: motionMs(zone === "hand" ? 260 : 230),
      easing: "cubic-bezier(.22, .72, .16, 1)",
      fill: "forwards"
    });
    await animation.finished.catch(() => {});
    clone.remove();
  } else {
    await wait(motionMs(180));
  }
  moveFrostyDiscardedCardToPile(playerIndex, card, zone);
  render();
  await wait(motionMs(55));
}

function createFrostyDiscardClone(playerIndex, card, zone, sourceRect) {
  const app = document.querySelector(".app");
  const appRect = app?.getBoundingClientRect();
  if (!app || !appRect || !sourceRect) return null;
  const clone = zone === "deck" || playerIndex === BOT_INDEX
    ? document.createElement("div")
    : (document.querySelector(`#hand .card[data-card-id="${card.id}"]`)?.cloneNode(true) ?? document.createElement("div"));
  clone.classList.add("frostyDiscardClone");
  clone.classList.toggle("cardBack", zone === "deck" || playerIndex === BOT_INDEX);
  clone.classList.toggle("card", zone === "hand" && playerIndex !== BOT_INDEX);
  clone.querySelectorAll?.(".effectTags, .abilityBlockedMark, .cardActions").forEach(element => element.remove());
  const scale = appScaleFromRect(appRect);
  clone.style.left = `${(sourceRect.left - appRect.left) / scale}px`;
  clone.style.top = `${(sourceRect.top - appRect.top) / scale}px`;
  clone.style.width = `${sourceRect.width / scale}px`;
  clone.style.height = `${sourceRect.height / scale}px`;
  app.append(clone);
  return clone;
}

function moveFrostyDiscardedCardToPile(playerIndex, card, zone) {
  const player = state.players[playerIndex];
  const source = zone === "deck" ? player?.deck : player?.hand;
  if (!source) return;
  let removed = null;
  const index = source.findIndex(item => item.id === card.id);
  if (index >= 0) {
    [removed] = source.splice(index, 1);
  } else if (zone === "deck" && source.length) {
    removed = source.shift();
  }
  discardToOriginalOwner(removed ?? card, playerIndex);
}

function measureFrostyHandCardRect(playerIndex, cardId) {
  if (playerIndex === BOT_INDEX) return measureOpponentLeftmostHandCardRect();
  return document.querySelector(`#hand .card[data-card-id="${cardId}"]`)?.getBoundingClientRect?.() ?? null;
}

function measureDeckPileCardRect(playerIndex) {
  const pile = document.querySelector(`[data-deck-player="${playerIndex}"]`);
  const card = pile?.querySelector(".deckBackSprite");
  return (card ?? pile)?.getBoundingClientRect?.() ?? null;
}

function legalBlockers(attacker, attackerIndex, defenderIndex) {
  const attackerKeywords = cardKeywords(attacker, attackerIndex);
  return state.players[defenderIndex].board.filter(blocker => {
    const blockerPower = cardPower(blocker, defenderIndex);
    if (blocker.cannotBlockThisTurn) return false;
    if (CREATURE_ABILITIES_ENABLED && state.players[attackerIndex].board.some(card => card.name === "Mole Machine") && blockerPower >= 7) return false;
    if (CREATURE_ABILITIES_ENABLED && state.players[attackerIndex].board.some(card => card.name === "Westside Monster")
        && cardKeywords(blocker, defenderIndex).includes("SNEAKY")) return false;
    if (attackerKeywords.includes("SNEAKY") && !cardKeywords(blocker, defenderIndex).includes("SNEAKY")) return false;
    if (CREATURE_ABILITIES_ENABLED && !animationTestMode && attacker.name === "Bee Bear" && blockerPower <= 6) return false;
    if (CREATURE_ABILITIES_ENABLED && !animationTestMode && state.players[attackerIndex].board.some(card => card.name === "Elephantopus") && blockerPower <= 4) return false;
    if (CREATURE_ABILITIES_ENABLED && !animationTestMode && state.players[attackerIndex].board.some(card => card.name === "Ferret Pacifier")) {
      const highestPower = Math.max(...state.players[defenderIndex].board.map(card => cardPower(card, defenderIndex)));
      if (blockerPower === highestPower) return false;
    }
    return true;
  });
}

function hasActiveShield(card, ownerIndex) {
  return cardKeywords(card, ownerIndex).includes("TOUGH") && card.damage < 1;
}

function hasBrokenShield(card, ownerIndex) {
  return cardKeywords(card, ownerIndex).includes("TOUGH") && card.damage >= 1;
}

async function enterAttackIntent(cardId, ownerIndex) {
  setCardAnimationState(CARD_ANIMATION_STATE.ATTACK_INTENT, cardId, { ownerIndex, transition: "entering" });
  render();
  await afterNextPaint();
  const clone = await waitForAttackIntentClone(cardId);
  refreshAttackCloneFace(clone, ownerIndex);
  await animateAttackIntentClone(clone, ownerIndex, "enter");
  setCardAnimationState(CARD_ANIMATION_STATE.ATTACK_INTENT, cardId, { ownerIndex, transition: "hold" });
}

async function exitAttackIntent(cardId, ownerIndex, targetCardId = "") {
  const clone = document.querySelector(`.attackIntentLayer [data-card-id="${cardId}"]`);
  if (targetCardId) await rotateAttackIntentToTarget(clone, ownerIndex, targetCardId);
  await animateAttackIntentClone(clone, ownerIndex, "exit");
  clearCardAnimationState(CARD_ANIMATION_STATE.ATTACK_INTENT, cardId);
  render();
}

async function finishAttackIntentForCreature(cardId, ownerIndex, targetCardId) {
  const clone = document.querySelector(`.attackIntentLayer [data-card-id="${cardId}"]`)
    || await waitForAttackIntentClone(cardId);
  refreshAttackCloneFace(clone, ownerIndex);
  await rotateAttackIntentToTarget(clone, ownerIndex, targetCardId);
  const rotate = clone?.dataset.intentRotate || "";
  clearCardAnimationState(CARD_ANIMATION_STATE.ATTACK_INTENT, cardId);
  return rotate;
}

async function resolveAttackIntentFace(cardId, attackerIndex, onImpact = null) {
  playSoundEffect("attack");
  const clone = document.querySelector(`.attackIntentLayer [data-card-id="${cardId}"]`);
  setCardAnimationState(CARD_ANIMATION_STATE.ATTACK_RESOLVE_FACE, cardId, { attackerIndex });
  if (clone) {
    refreshAttackCloneFace(clone, attackerIndex);
    await animateAttackIntentFaceTravel(clone, attackerIndex, onImpact);
  } else if (typeof onImpact === "function") {
    await onImpact();
  }
  clearCardAnimationState(CARD_ANIMATION_STATE.ATTACK_RESOLVE_FACE, cardId);
  clearCardAnimationState(CARD_ANIMATION_STATE.ATTACK_INTENT, cardId);
  render();
}

function refreshAttackCloneFace(clone, ownerIndex) {
  if (!clone) return;
  const cardId = clone.dataset.cardId;
  const card = state.players[ownerIndex]?.board.find(item => item.id === cardId);
  if (!card) return;
  applyCardSprite(clone, card);
  clone.innerHTML = cardFaceHtml(card, cardPower(card, ownerIndex), cardKeywords(card, ownerIndex), "board", ownerIndex);
}

function waitForAttackIntentClone(cardId) {
  return new Promise(resolve => {
    let tries = 0;
    const findClone = () => {
      const clone = document.querySelector(`.attackIntentLayer [data-card-id="${cardId}"]`);
      if (clone || tries > 30) {
        resolve(clone);
        return;
      }
      tries += 1;
      window.requestAnimationFrame(findClone);
    };
    window.requestAnimationFrame(findClone);
  });
}

async function rotateAttackIntentToTarget(clone, ownerIndex, targetCardId) {
  const target = findRenderedBoardSlot(targetCardId);
  const layerRect = clone?.closest(".cardTopLayer")?.getBoundingClientRect();
  if (!clone || !target || !layerRect) return;

  const vector = localCenterVector(
    rectToLocal(clone.getBoundingClientRect(), layerRect),
    rectToLocal(target.getBoundingClientRect(), layerRect)
  );
  const rotate = attackRotationForVector(vector, ownerIndex);
  const offsetY = ownerIndex === 0 ? -10 : 10;
  const baseScale = attackIntentScale(clone);
  const baseTransform = `translateY(${offsetY}px) scale(${(baseScale * 1.06).toFixed(4)})`;
  const targetTransform = `${baseTransform} ${rotate}`;
  clone.dataset.intentRotate = rotate;
  const animation = clone.animate([
    { opacity: 1, transform: baseTransform, offset: 0 },
    { opacity: 1, transform: targetTransform, offset: 1 }
  ], {
    duration: motionMs(ATTACK_INTENT_TARGET_TURN_MS),
    easing: "cubic-bezier(.2, .8, .2, 1)",
    fill: "forwards"
  });
  await animation.finished.catch(() => {});
  animation.cancel();
  clone.style.transform = "";
  clone.style.setProperty("--attack-intent-extra-rotate", rotate);
}

function shortestRotationDegrees(degrees) {
  return ((((degrees + 180) % 360) + 360) % 360) - 180;
}

function rectToLocal(rect, rootRect) {
  const scale = appScaleFromRect(rootRect);
  return {
    left: (rect.left - rootRect.left) / scale,
    right: (rect.right - rootRect.left) / scale,
    top: (rect.top - rootRect.top) / scale,
    bottom: (rect.bottom - rootRect.top) / scale,
    width: rect.width / scale,
    height: rect.height / scale
  };
}

function localCenterVector(fromRect, toRect) {
  const dx = (toRect.left + toRect.width / 2) - (fromRect.left + fromRect.width / 2);
  const dy = (toRect.top + toRect.height / 2) - (fromRect.top + fromRect.height / 2);
  const distance = Math.hypot(dx, dy);
  return {
    dx,
    dy,
    distance,
    unitX: distance ? dx / distance : 0,
    unitY: distance ? dy / distance : 0
  };
}

function ownerIndexForBoardCard(cardId) {
  return state.players.findIndex(player => player.board.some(card => card.id === cardId));
}

function attackRotationForVector(vector, ownerIndex) {
  const targetAngle = Math.atan2(vector.dx, -vector.dy) * 180 / Math.PI;
  const angle = shortestRotationDegrees(ownerIndex === BOT_INDEX ? targetAngle + 180 : targetAngle);
  return `rotate(${angle.toFixed(1)}deg)`;
}

function localWindupTransform(vector, distance = 14, scale = 1.04, rotate = "") {
  const windupX = -vector.unitX * distance;
  const windupY = -vector.unitY * distance;
  return `translate3d(${windupX.toFixed(2)}px, ${windupY.toFixed(2)}px, 0) scale(${scale}) ${rotate}`;
}

function attackIntentScale(clone) {
  const scale = Number.parseFloat(clone?.style?.getPropertyValue("--intent-scale") || "1");
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

async function animateAttackIntentClone(clone, ownerIndex, mode) {
  if (!clone) return;
  const offsetY = ownerIndex === 0 ? -10 : 10;
  const rotate = clone.dataset.intentRotate || "";
  const baseScale = attackIntentScale(clone);
  const scaled = value => (baseScale * value).toFixed(4);
  const frames = mode === "enter"
    ? [
      { opacity: 1, transform: `translateY(0) scale(${scaled(1)})`, offset: 0 },
      { opacity: 1, transform: `translateY(${offsetY}px) scale(${scaled(1.08)})`, offset: 0.78 },
      { opacity: 1, transform: `translateY(${offsetY}px) scale(${scaled(1.06)})`, offset: 1 }
    ]
    : [
      { opacity: 1, transform: `translateY(${offsetY}px) scale(${scaled(1.06)}) ${rotate}`, offset: 0 },
      { opacity: 1, transform: `translateY(${offsetY * 0.25}px) scale(${scaled(1.02)}) ${rotate}`, offset: 0.68 },
      { opacity: 0, transform: `translateY(0) scale(${scaled(1)}) ${rotate}`, offset: 1 }
    ];
  const animation = clone.animate(frames, {
    duration: motionMs(mode === "enter" ? ATTACK_INTENT_ENTER_MS : ATTACK_INTENT_EXIT_MS),
    easing: "cubic-bezier(.2, .8, .2, 1)",
    fill: "forwards"
  });
  await animation.finished.catch(() => {});
  animation.cancel();
  if (mode === "enter") {
    clone.style.transform = "";
  }
}

async function animateAttackIntentFaceTravel(clone, attackerIndex, onImpact = null) {
  const layer = clone?.closest(".cardTopLayer");
  const arenaRect = els.arena?.getBoundingClientRect();
  const layerRect = layer?.getBoundingClientRect();
  if (!arenaRect || !layerRect) return;

  const cloneRect = rectToLocal(clone.getBoundingClientRect(), layerRect);
  const arenaLocal = rectToLocal(arenaRect, layerRect);
  const baseLeft = cloneRect.left;
  const baseTop = cloneRect.top;
  const cloneWidth = cloneRect.width;
  const cloneHeight = cloneRect.height;
  const targetTop = attackerIndex === 0
    ? arenaLocal.top
    : arenaLocal.bottom - cloneHeight;
  const targetY = targetTop - baseTop;
  const originRect = { left: baseLeft, top: baseTop, width: cloneWidth, height: cloneHeight };
  const targetRect = { left: baseLeft, top: targetTop, width: cloneWidth, height: cloneHeight };
  const vector = localCenterVector(originRect, targetRect);
  const baseScale = attackIntentScale(clone);
  const scaled = value => (baseScale * value).toFixed(4);
  const originTransform = `translate3d(0, 0, 0) scale(${scaled(1)})`;
  const holdTransform = `translate3d(${(vector.unitX * 10).toFixed(2)}px, ${(vector.unitY * 10).toFixed(2)}px, 0) scale(${scaled(1.06)})`;
  const windupTransform = localWindupTransform(vector, 14.5, Number.parseFloat(scaled(1.04)));
  const hitTransform = `translate3d(0, ${targetY}px, 0) scale(${scaled(1.08)})`;

  const outbound = clone.animate([
    { opacity: 1, transform: holdTransform, offset: 0 },
    { opacity: 1, transform: windupTransform, offset: 0.36 },
    { opacity: 1, transform: hitTransform, offset: 1 }
  ], {
    duration: motionMs(ATTACK_FACE_TRAVEL_MS),
    easing: "cubic-bezier(.72, 0, 1, .32)",
    fill: "forwards"
  });
  await outbound.finished.catch(() => {});
  playSoundEffect("directHit");
  animations.attackFace(clone.dataset.cardId, attackerIndex);
  const impactPromise = typeof onImpact === "function"
    ? Promise.resolve(onImpact()).catch(error => console.warn("Attack impact failed.", error))
    : null;

  const inbound = clone.animate([
    { opacity: 1, transform: hitTransform, offset: 0 },
    { opacity: 1, transform: originTransform, offset: 1 }
  ], {
    duration: motionMs(ATTACK_FACE_TRAVEL_MS),
    easing: "cubic-bezier(.2, .8, .2, 1)",
    fill: "forwards"
  });
  await inbound.finished.catch(() => {});
  if (impactPromise) await impactPromise;
}

async function animateAttackFace(attackerId, attackerIndex) {
  playSoundEffect("directHit");
  setCardAnimationState(CARD_ANIMATION_STATE.ATTACK_RESOLVE_FACE, attackerId, { attackerIndex });
  await animations.attackFace(attackerId, attackerIndex);
  clearCardAnimationState(CARD_ANIMATION_STATE.ATTACK_RESOLVE_FACE, attackerId);
}

async function animateAttackCreature(attackerId, targetId, rotate = "") {
  playSoundEffect("attack");
  setCardAnimationState(CARD_ANIMATION_STATE.ATTACK_RESOLVE_CREATURE, attackerId, { targetId });
  setCardAnimationState(CARD_ANIMATION_STATE.DAMAGED, targetId, { attackerId });
  await animateAttackCreatureTravel(attackerId, targetId, rotate);
  clearCardAnimationState(CARD_ANIMATION_STATE.ATTACK_RESOLVE_CREATURE, attackerId);
  clearCardAnimationState(CARD_ANIMATION_STATE.DAMAGED, targetId);
  render();
  await afterNextPaint();
}

async function animateAttackCreatureTravel(attackerId, targetId, rotate = "") {
  const sourceSlot = findRenderedBoardSlot(attackerId);
  const targetSlot = findRenderedBoardSlot(targetId);
  const sourceCard = findRenderedBoardCard(attackerId);
  const targetCard = findRenderedBoardCard(targetId);
  const app = document.querySelector(".app");
  if (!sourceSlot || !targetSlot || !sourceCard || !targetCard || !app) {
    await animations.attackCreature(attackerId, targetId);
    return;
  }
  const attackerOwnerIndex = ownerIndexForBoardCard(attackerId);
  const attackerCard = state.players[attackerOwnerIndex]?.board.find(card => card.id === attackerId);
  if (!attackerCard) {
    await animations.attackCreature(attackerId, targetId);
    return;
  }

  const layer = document.createElement("div");
  layer.className = "cardTopLayer attackResolveLayer";
  app.append(layer);
  const layerRect = layer.getBoundingClientRect();
  const intentClone = document.querySelector(`.attackIntentLayer [data-card-id="${attackerId}"]`);
  const baseSourceRect = rectToLocal(sourceSlot.getBoundingClientRect(), layerRect);
  const intentSourceRect = intentClone ? rectToLocal(intentClone.getBoundingClientRect(), layerRect) : null;
  const sourceRect = intentSourceRect
    ? {
      left: intentSourceRect.left + intentSourceRect.width / 2 - baseSourceRect.width / 2,
      right: intentSourceRect.left + intentSourceRect.width / 2 + baseSourceRect.width / 2,
      top: intentSourceRect.top + intentSourceRect.height / 2 - baseSourceRect.height / 2,
      bottom: intentSourceRect.top + intentSourceRect.height / 2 + baseSourceRect.height / 2,
      width: baseSourceRect.width,
      height: baseSourceRect.height
    }
    : baseSourceRect;
  const targetRect = rectToLocal(targetSlot.getBoundingClientRect(), layerRect);
  const vector = localCenterVector(sourceRect, targetRect);
  const attackRotate = rotate || attackRotationForVector(vector, attackerOwnerIndex);
  const edgeTouchOffset = sourceRect.height / 2;
  const travelX = vector.dx - vector.unitX * edgeTouchOffset;
  const travelY = vector.dy - vector.unitY * edgeTouchOffset;
  const baseScale = sourceRect.width / CARD_BASE_WIDTH;
  const scaled = value => Number.parseFloat((baseScale * value).toFixed(4));
  const windupTransform = localWindupTransform(vector, 14, scaled(1.04), attackRotate);
  const hitTransform = `translate3d(${travelX}px, ${travelY}px, 0) scale(${scaled(1.08)}) ${attackRotate}`;
  const originAttackAngleTransform = `translate3d(0, 0, 0) scale(${scaled(intentClone ? 1.06 : 1)}) ${attackRotate}`;
  const originTransform = `translate3d(0, 0, 0) scale(${scaled(1)}) rotate(0deg)`;
  const clone = document.createElement("article");
  clone.className = "card attackResolveClone animationCard";
  clone.dataset.cardId = attackerCard.id;
  clone.setAttribute("aria-hidden", "true");
  applyCardSprite(clone, attackerCard);
  clone.innerHTML = cardFaceHtml(attackerCard, cardPower(attackerCard, attackerOwnerIndex), cardKeywords(attackerCard, attackerOwnerIndex), "board", attackerOwnerIndex);
  clone.style.left = `${sourceRect.left - ((CARD_BASE_WIDTH - sourceRect.width) / 2)}px`;
  clone.style.top = `${sourceRect.top - ((CARD_BASE_HEIGHT - sourceRect.height) / 2)}px`;
  clone.style.width = `${CARD_BASE_WIDTH}px`;
  clone.style.height = `${CARD_BASE_HEIGHT}px`;
  clone.style.minWidth = `${CARD_BASE_WIDTH}px`;
  clone.style.minHeight = `${CARD_BASE_HEIGHT}px`;
  clone.style.transform = originAttackAngleTransform;
  layer.append(clone);
  sourceCard.classList.add("attackSourceGhost");
  clearAttackIntentLayer();
  await afterNextPaint();

  const outbound = clone.animate([
    { opacity: 1, transform: originAttackAngleTransform, offset: 0 },
    { opacity: 1, transform: windupTransform, offset: 0.36 },
    { opacity: 1, transform: hitTransform, offset: 1 }
  ], {
    duration: motionMs(ATTACK_FACE_TRAVEL_MS),
    easing: "cubic-bezier(.72, 0, 1, .32)",
    fill: "forwards"
  });
  await outbound.finished.catch(() => {});
  playSoundEffect("hit");
  targetCard.classList.add("cardHitShake");
  await wait(motionMs(220));
  targetCard.classList.remove("cardHitShake");

  const inbound = clone.animate([
    { opacity: 1, transform: hitTransform, offset: 0 },
    { opacity: 1, transform: originTransform, offset: 1 }
  ], {
    duration: motionMs(ATTACK_FACE_TRAVEL_MS),
    easing: "cubic-bezier(.2, .8, .2, 1)",
    fill: "forwards"
  });
  await inbound.finished.catch(() => {});
  if (sourceCard.isConnected) sourceCard.classList.remove("attackSourceGhost");
  if (layer.isConnected) layer.remove();
}

function canAttack(card, ownerIndex) {
  if (animationTestMode) return state.players[ownerIndex].board.some(c => c.id === card.id);
  if (!canAttackIgnoringCaptainHippo(card, ownerIndex)) return false;
  const forcedAttackers = captainHippoForcedAttackers(ownerIndex);
  if (forcedAttackers.length) return forcedAttackers.some(attacker => attacker.id === card.id);
  return true;
}

function canAttackIgnoringCaptainHippo(card, ownerIndex) {
  if (card.exhausted) return false;
  if (state.frenzyOnly && state.frenzyOnly !== card.id) return false;
  if (CREATURE_ABILITIES_ENABLED && state.players[1 - ownerIndex]?.board.some(enemyCard => enemyCard.name === "Westside Monster")
      && cardKeywords(card, ownerIndex).includes("SNEAKY")) return false;
  if (CREATURE_ABILITIES_ENABLED && state.players[1 - ownerIndex]?.board.some(enemyCard => enemyCard.name === "Hamster Lion")) {
    const lowestPower = Math.min(...state.players[ownerIndex].board.map(boardCard => cardPower(boardCard, ownerIndex)));
    if (cardPower(card, ownerIndex) === lowestPower) return false;
  }
  return card.attacksThisTurn === 0 || canAttackAgain(card, ownerIndex);
}

function captainHippoForcedAttackers(ownerIndex) {
  const player = state.players[ownerIndex];
  const enemy = state.players[1 - ownerIndex];
  if (!CREATURE_ABILITIES_ENABLED || !player || !enemy) return [];
  if (player.board.some(card => card.cakeForcedAttack)) return [];
  if (!enemy.board.some(card => card.name === "Captain Hippo")) return [];
  return player.board.filter(card => (
    cardKeywords(card, ownerIndex).includes("HUNTER")
    && canAttackIgnoringCaptainHippo(card, ownerIndex)
  ));
}

function canAttackAgain(card, ownerIndex) {
  return cardKeywords(card, ownerIndex).includes("FRENZY") && card.attacksThisTurn === 1 && state.players[ownerIndex].board.some(c => c.id === card.id);
}

function canPlayerAct(playerIndex) {
  const player = state.players[playerIndex];
  if (!player) return false;
  if (player.hand.length > 0) return true;
  return player.board.some(card => canAttack(card, playerIndex) || canUseEvolutionAction(card, playerIndex));
}

function checkActionLoss() {
  if (hasWinner() || state.phase !== "action") return;
  if (canPlayerAct(state.active)) return;
  finishGame(1 - state.active, `${state.players[state.active].name} không thể hành động.`);
}

async function combat(attacker, blocker, attackerIndex, blockerIndex) {
  let attackerPower = cardPower(attacker, attackerIndex);
  let blockerPower = cardPower(blocker, blockerIndex);
  if (CREATURE_ABILITIES_ENABLED && (attacker.name === "Sawn" || blocker.name === "Sawn")) {
    [attackerPower, blockerPower] = [blockerPower, attackerPower];
  }
  const attackerPoison = cardKeywords(attacker, attackerIndex).includes("POISONOUS");
  const blockerPoison = cardKeywords(blocker, blockerIndex).includes("POISONOUS");
  const attackerOutpowered = blockerPower >= attackerPower;
  const blockerOutpowered = attackerPower >= blockerPower;
  const defeatAttacker = blockerPoison || attackerOutpowered;
  const defeatBlocker = attackerPoison || blockerOutpowered;
  log(`${attacker.name} (${attackerPower}) giao chiến với ${blocker.name} (${blockerPower}).`);
  if (animationTestMode) {
    const defeated = [];
    if (blockerPower >= attackerPower) defeated.push({ card: attacker, ownerIndex: attackerIndex });
    if (attackerPower >= blockerPower) defeated.push({ card: blocker, ownerIndex: blockerIndex });
    for (const defeat of defeated) {
      await removeBoardCardForAnimationTest(defeat.card, defeat.ownerIndex);
    }
    if (!defeated.length) log("Animation test: không có Quái vật nào rời sân.");
    render();
    return;
  }
  const defeated = [];
  if (defeatAttacker) {
    const defeat = await damageOrDefeat(attacker, attackerIndex, { deferAbility: true });
    if (defeat) defeated.push(defeat);
  }
  if (defeatBlocker) {
    const defeat = await damageOrDefeat(blocker, blockerIndex, { deferAbility: true });
    if (defeat) defeated.push(defeat);
  }
  for (const defeat of defeated) {
    await resolveDefeatedAbility(defeat.card, defeat.ownerIndex);
  }
  render();
}

async function removeBoardCardForAnimationTest(card, ownerIndex) {
  const player = state.players[ownerIndex];
  if (!player.board.some(boardCard => boardCard.id === card.id)) return;
  await animateBoardCardExit(card.id);
  player.board = player.board.filter(boardCard => boardCard.id !== card.id);
  discardToOriginalOwner(card, ownerIndex);
  clearCardAnimationState(CARD_ANIMATION_STATE.BOARD_EXIT, card.id);
  log(`Animation test: ${card.name} rời sân sau combat.`);
}

async function damageOrDefeat(card, ownerIndex, options = {}) {
  if (card.cannotBeDefeatedThisTurn) return null;
  if (hasActiveShield(card, ownerIndex)) {
    card.damage += 1;
    log(`${card.name} mất 1 HP Khiên.`);
    return null;
  }
  return defeatCreature(card.id, ownerIndex, options);
}

async function defeatMatching(cards, ownerIndex) {
  for (const card of [...cards]) await defeatCreature(card.id, ownerIndex);
}

async function defeatOne(actorIndex, candidates, title, allowSkip = true, sourceCard = null) {
  if (!candidates.length) return;
  const targetOwnerIndex = 1 - actorIndex;
  const pickedId = actorIndex === 0
    ? await pickDefeatTargetFromBoard(candidates, actorIndex, targetOwnerIndex, sourceCard, actorIndex)
    : await pickCard(candidates, title, allowSkip, { actorIndex, ownerIndex: targetOwnerIndex });
  if (pickedId) await defeatCreature(pickedId, 1 - actorIndex);
}

async function defeatCreature(cardId, ownerIndex, options = {}) {
  const player = state.players[ownerIndex];
  if (!player.board.some(card => card.id === cardId)) return null;
  await animateBoardCardExit(cardId);
  const index = player.board.findIndex(card => card.id === cardId);
  if (index < 0) {
    clearCardAnimationState(CARD_ANIMATION_STATE.BOARD_EXIT, cardId);
    return null;
  }
  const [card] = player.board.splice(index, 1);
  clearCardAnimationState(CARD_ANIMATION_STATE.BOARD_EXIT, cardId);
  card.damage = 0;
  card.exhausted = false;
  card.attacksThisTurn = 0;
  const discardOwnerIndex = discardToOriginalOwner(card, ownerIndex);
  const ownerNote = discardOwnerIndex !== ownerIndex ? ` và về Mộ bài của ${state.players[discardOwnerIndex].name}` : "";
  log(`${card.name} bị hạ${ownerNote}.`);
  if (!options.deferAbility) await resolveDefeatedAbility(card, ownerIndex);
  return { card, ownerIndex };
}

async function animateBoardCardExit(cardId) {
  if (isCardAnimationState(cardId, CARD_ANIMATION_STATE.BOARD_EXIT)) return;
  playSoundEffect("defeat");
  setCardAnimationState(CARD_ANIMATION_STATE.BOARD_EXIT, cardId);
  render();
  await wait(motionMs(BOARD_CARD_EXIT_MS));
}

async function resolveDefeatedAbility(card, ownerIndex) {
  if (!CREATURE_ABILITIES_ENABLED) return;
  if (!DEFEATED_ABILITY_CARDS.has(card.name)) return;
  announceAbilityActivation(card, ownerIndex, "Bị hạ");
  if (card.name === "Strange Barrel") {
    const enemy = state.players[1 - ownerIndex];
    const owner = state.players[ownerIndex];
    const stolen = takeRandom(enemy.hand, 2);
    addCardsToHand(ownerIndex, stolen);
    drawToFive(enemy);
    log(`${owner.name} lấy ${stolen.length} lá ngẫu nhiên từ tay đối thủ.`);
  }
  if (card.name === "Harpy Mother") {
    await stealSmallCreatures(ownerIndex, 2, card);
  }
  if (card.name === "Explosive Toad") {
    await chooseCreatureToDefeat(1 - ownerIndex, ownerIndex, card);
  }
  if (card.name === "Puffermech") {
    const enemyIndex = 1 - ownerIndex;
    await defeatMatching(state.players[enemyIndex].board.filter(target => cardPower(target, enemyIndex) >= 8), enemyIndex);
  }
  if (card.name === "Steelhorn") {
    await chooseCardsToDiscard(1 - ownerIndex, ownerIndex, card, 3);
  }
  if (card.name === "Sweet Fighter") {
    await gainLife(state.players[ownerIndex], 2);
  }
  if (card.name === "Radioactive Rabbit") {
    for (const ally of [...state.players[ownerIndex].board]) await defeatCreature(ally.id, ownerIndex);
  }
}

function discardRandom(player, amount) {
  const discarded = takeRandom(player.hand, amount);
  const fallbackIndex = state.players.indexOf(player);
  for (const card of discarded) discardToOriginalOwner(card, fallbackIndex);
}

async function chooseCardsToDiscard(playerIndex, actorIndex, sourceCard, amount) {
  let discardedCount = 0;
  for (let i = 0; i < amount; i += 1) {
    const picked = await chooseSingleCardToDiscard(playerIndex, actorIndex, sourceCard, i, amount);
    if (!picked) return;
    discardHandCard(playerIndex, picked);
    discardedCount += 1;
    if (amount > 1) {
      showRemoteMessage("Chọn 1 lá trên tay để bỏ", `(${i + 1}/${amount})`, { sticky: playerIndex === 0 });
      if (playerIndex === BOT_INDEX) await wait(motionMs(220));
    }
    if (hasWinner()) return;
  }
  if (discardedCount > 0) {
    const drawn = drawToFive(state.players[playerIndex]);
    if (drawn > 0) log(`${state.players[playerIndex].name} rút ${drawn} lá để đủ 5 lá sau khi bỏ bài.`);
  }
  clearRemoteMessage();
  render();
}

async function chooseSingleCardToDiscard(playerIndex, actorIndex, sourceCard, step, total) {
  const player = state.players[playerIndex];
  if (!player.hand.length) {
    log(`${player.name} không có bài trên tay để bỏ.`);
    return "";
  }

  const remainingText = total > 1 ? ` (${step}/${total})` : "";
  showRemoteMessage("Chọn 1 lá trên tay để bỏ", remainingText.trim(), { sticky: playerIndex === 0 });
  const pickedId = playerIndex === 0
    ? await pickDiscardFromHand(playerIndex, actorIndex, sourceCard)
    : await askChoice({
      title: "Bỏ bài",
      text: `${player.name}: chọn 1 lá trên tay để bỏ bởi ${displayCardName(sourceCard)}${remainingText}.`,
      options: player.hand.map(card => ({ label: `${displayCardName(card)} (${card.basePower})`, value: card.id })),
      context: { type: "discard", actorIndex: playerIndex, ownerIndex: playerIndex, cards: player.hand, sourceCard }
    });

  return pickedId;
}

function pickDiscardFromHand(playerIndex, actorIndex, sourceCard, actionLabel = "Bỏ") {
  return new Promise(resolve => {
    choiceDepth += 1;
    state.phase = "choice";
    state.active = actorIndex;
    inspectedLocalHandCardId = "";
    discardSelection = {
      ownerIndex: playerIndex,
      turnOwnerIndex: actorIndex,
      sourceCard,
      cardIds: new Set(state.players[playerIndex].hand.map(card => card.id)),
      actionLabel,
      resolve
    };
    render();
  });
}

function finishDiscardSelection(cardId) {
  if (!discardSelection || !discardSelection.cardIds.has(cardId)) return;
  const resolve = discardSelection.resolve;
  const turnOwnerIndex = discardSelection.turnOwnerIndex;
  discardSelection = null;
  inspectedLocalHandCardId = "";
  choiceDepth -= 1;
  state.active = turnOwnerIndex;
  if (els.cardInspectDialog.open) els.cardInspectDialog.close();
  clearRemoteMessage();
  if (!choiceDepth && !hasWinner()) state.phase = "action";
  render();
  resolve(cardId);
}

function discardHandCard(playerIndex, cardId) {
  const player = state.players[playerIndex];
  const index = player.hand.findIndex(card => card.id === cardId);
  if (index < 0) return;
  const [card] = player.hand.splice(index, 1);
  discardToOriginalOwner(card, playerIndex);
  log(`${player.name} bỏ ${card.name}.`);
  checkGameOver();
}

function takeRandom(cards, amount) {
  const taken = [];
  for (let i = 0; i < amount && cards.length; i += 1) {
    const index = Math.floor(Math.random() * cards.length);
    taken.push(cards.splice(index, 1)[0]);
  }
  return taken;
}

async function loseLife(player, amount, options = {}) {
  if (amount <= 0 || hasWinner()) return;
  playSoundEffect("lifeLoss");
  player.life -= amount;
  if (options.scoreboardOnly) {
    renderScoreboardSafe();
  } else {
    render();
  }
  const playerIndex = state.players.indexOf(player);
  const isLethal = player.life <= 0;
  const impactPromise = (isLethal || options.screenImpact)
    ? animations.screenImpact()
    : null;
  await animations.lifeLoss(playerIndex, amount);
  if (impactPromise) await impactPromise;
  checkGameOver();
  if (hasWinner()) {
    render();
    return;
  }
  await triggerHyenixFromDiscard(playerIndex);
  checkGameOver();
}

async function gainLife(player, amount) {
  if (amount <= 0) return;
  playSoundEffect("lifeGain");
  player.life += amount;
  renderScoreboardSafe();
  await animations.lifeGain(state.players.indexOf(player), amount);
}

async function setLife(player, amount) {
  const before = player.life;
  player.life = amount;
  const delta = amount - before;
  const playerIndex = state.players.indexOf(player);
  if (delta > 0) {
    playSoundEffect("lifeGain");
    renderScoreboardSafe();
    await animations.lifeGain(playerIndex, delta);
  }
  if (delta < 0 && (playerIndex === 0 || amount <= 0)) {
    playSoundEffect("lifeLoss");
    renderScoreboardSafe();
    await Promise.all([
      animations.lifeLoss(playerIndex, Math.abs(delta)),
      animations.screenImpact()
    ]);
  } else if (delta < 0) {
    renderScoreboardSafe();
    await animations.lifeLoss(playerIndex, Math.abs(delta));
  }
  checkGameOver();
  if (hasWinner()) {
    render();
    return;
  }
  if (delta < 0) await triggerHyenixFromDiscard(playerIndex);
  checkGameOver();
}

async function triggerHyenixFromDiscard(playerIndex) {
  if (!CREATURE_ABILITIES_ENABLED || animationTestMode || playerIndex < 0) return;
  const player = state.players[playerIndex];
  const hyenixCards = player.discard.filter(card => card.name === "Hyenix");
  for (const card of hyenixCards) {
    const index = player.discard.findIndex(item => item.id === card.id);
    if (index < 0) continue;
    const sourceRect = measureDiscardPileCardRect(playerIndex);
    announceAbilityActivation(card, playerIndex, "Mộ bài");
    setOpponentAbilityMessage(card, displayAbility(card));
    const choice = playerIndex === 0
      ? await waitForHyenixChoice(playerIndex, card, sourceRect)
      : "play";
    if (choice !== "play") {
      log(`${player.name} không chơi ${card.name} từ Mộ bài.`);
      render();
      continue;
    }
    const currentIndex = player.discard.findIndex(item => item.id === card.id);
    if (currentIndex < 0) continue;
    const [revived] = player.discard.splice(currentIndex, 1);
    log(`${revived.name} tự vào sân từ Mộ bài sau khi ${player.name} mất LP.`);
    suppressedBoardEnterCardIds.add(revived.id);
    player.board.push(revived);
    render();
    suppressedBoardEnterCardIds.delete(revived.id);
    await wait(motionMs(180));
  }
}

function waitForHyenixChoice(playerIndex, card, sourceRect = null) {
  return new Promise(resolve => {
    choiceDepth += 1;
    state.phase = "choice";
    state.active = playerIndex;
    hyenixChoicePrompt = { actorIndex: playerIndex, ownerIndex: playerIndex, cardId: card.id, card, resolve };
    showRemoteMessage("Chơi từ Mộ bài?", displayCardName(card), { sticky: true });
    showHyenixChoiceOverlay(card, playerIndex, sourceRect).catch(() => {});
    render();
  });
}

async function resolveHyenixChoicePrompt(choice) {
  if (!hyenixChoicePrompt) return;
  const prompt = hyenixChoicePrompt;
  hyenixChoicePrompt = null;
  choiceDepth -= 1;
  state.active = prompt.actorIndex;
  clearRemoteMessage();
  await closeHyenixChoiceOverlay(prompt.ownerIndex);
  if (!choiceDepth && !hasWinner()) state.phase = "action";
  render();
  prompt.resolve(choice);
}

async function playDuelLifeDeltaFxFromStateDiff(previousState, nextState, options = {}) {
  if (!duelModeActive || !previousState || !nextState) return;
  const deltas = [];
  const fxPromises = [];
  for (let index = 0; index < 2; index += 1) {
    const before = previousState.players?.[index]?.life;
    const after = nextState.players?.[index]?.life;
    if (!Number.isFinite(before) || !Number.isFinite(after) || after === before) continue;
    deltas.push({ index, delta: after - before, after });
  }
  if (!deltas.length) return;
  for (const { index, after } of deltas) {
    if (state.players?.[index]) state.players[index].life = after;
  }
  renderScoreboardSafe();
  for (const { index, delta } of deltas) {
    if (delta > 0) {
      playSoundEffect("lifeGain");
      fxPromises.push(animations.lifeGain(index, delta));
    } else {
      playSoundEffect("lifeLoss");
      fxPromises.push(animations.lifeLoss(index, Math.abs(delta)));
      if (index === 0 || options.forceImpact) fxPromises.push(animations.screenImpact());
    }
  }
  if (fxPromises.length) await Promise.all(fxPromises);
}

function checkGameOver() {
  if (state.winner !== null) return;
  const lifeLoser = state.players.findIndex(player => player.life <= 0);
  if (lifeLoser >= 0) {
    finishGame(1 - lifeLoser, `${state.players[lifeLoser].name} hết LP.`);
    return;
  }
}

function finishGame(winnerIndex, reason) {
  endHandScrubGesture();
  const learnedGameCount = !duelModeActive && !animationTestMode
    ? bot.completeLearningGame(winnerIndex)
    : 0;
  state.winner = winnerIndex;
  state.phase = "gameover";
  state.frenzyOnly = null;
  state.extraTurn = false;
  state.extraTurnSource = "";
  blockSelection = null;
  blockPrompt = null;
  discardSelection = null;
  discardPileSelection = null;
  defeatSelection = null;
  disableBlockSelection = null;
  stealSelection = null;
  hunterAttackPrompt = null;
  hunterTargetSelection = null;
  frenzySecondAttackPrompt = null;
  receivedCardChoicePrompt = null;
  hyenixChoicePrompt = null;
  drOrangeChoicePrompt = null;
  earwigChoicePrompt = null;
  utilityKeywordSelection = null;
  pendingMindbug = null;
  choicePromptActorIndex = null;
  activeChoicePromptContext = null;
  activeChoicePromptResolve = null;
  activeChoicePreviousPhase = null;
  debugTargetCardRect = null;
  clearCardAnimationState();
  choiceDepth = 0;
  if (els.choiceDialog.open) els.choiceDialog.close();
  log(`${state.players[winnerIndex].name} thắng! ${reason}`);
  if (learnedGameCount) {
    log(`Đã lưu dữ liệu học của ván ${learnedGameCount}/100.`);
    persistBotLearningFile();
  }
  showRemoteMessage(winnerIndex === 0 ? "Thắng" : "Thua", "", { sticky: true });
  showGameOverDialog(winnerIndex, reason);
}

function showGameOverDialog(winnerIndex = state.winner) {
  if (!els.gameOverDialog) return;
  const resolvedWinnerIndex = state.winner ?? winnerIndex;
  const didLocalWin = resolvedWinnerIndex === 0;
  if (lastGameOverSoundWinner !== resolvedWinnerIndex) {
    playSoundEffect(didLocalWin ? "win" : "lose");
    lastGameOverSoundWinner = resolvedWinnerIndex;
  }
  document.body.classList.toggle("localGameLost", !didLocalWin);
  if (els.gameOverBanner) {
    const bannerSrc = didLocalWin ? "assets/ui/win.png" : "assets/ui/lose.png";
    els.gameOverBanner.setAttribute("src", bannerSrc);
    els.gameOverBanner.alt = didLocalWin ? "Thắng" : "Thua";
    els.gameOverBanner.hidden = false;
  }
  els.gameOverTitle.textContent = didLocalWin ? "Thắng" : "Thua";
  els.gameOverText.textContent = "";
  if (!els.gameOverDialog.open) els.gameOverDialog.showModal();
}

function closeGameOverDialog() {
  document.body.classList.remove("localGameLost");
  if (els.gameOverBanner) {
    els.gameOverBanner.hidden = true;
    els.gameOverBanner.removeAttribute("src");
  }
  if (els.gameOverDialog?.open) els.gameOverDialog.close();
}

function setCardAnimationState(name, cardId = "", data = {}) {
  if (!cardId || name === CARD_ANIMATION_STATE.IDLE) return;
  cardAnimationStates.set(cardId, { name, cardId, data });
}

function clearCardAnimationState(name = "", cardId = "") {
  if (!name && !cardId) {
    cardAnimationStates.clear();
    return;
  }
  if (cardId) {
    const state = cardAnimationStates.get(cardId);
    if (state && (!name || state.name === name)) cardAnimationStates.delete(cardId);
    return;
  }
  for (const [stateCardId, state] of cardAnimationStates) {
    if (state.name === name) cardAnimationStates.delete(stateCardId);
  }
}

function isCardAnimationState(cardId, name) {
  return cardAnimationStates.get(cardId)?.name === name;
}

function attackIntentAnimationState() {
  for (const state of cardAnimationStates.values()) {
    if (state.name === CARD_ANIMATION_STATE.ATTACK_INTENT) return state;
  }
  return null;
}

function duelPendingSourceCardId() {
  if (!duelModeActive || !state.pending) return "";
  if (state.pending.type === "hunter") return state.pending.attackerId ?? "";
  if (state.pending.type === "mindbug") return state.pending.cardId ?? "";
  return state.pending.sourceCard?.id ?? "";
}

function duelPendingSourceTargetIds() {
  if (!duelModeActive || !state.pending) return new Set();
  if (state.pending.type === "hunter") return new Set(state.pending.targetIds ?? []);
  if (["defeat", "steal", "experiment", "discard-pile", "disable-block", "forced-attack"].includes(state.pending.type)) return new Set(state.pending.cardIds ?? []);
  if (state.pending.type === "block" && state.pending.actorIndex === 0) return new Set(state.pending.blockerIds ?? []);
  return new Set();
}

function isDuelBlockCandidate(card, ownerIndex, zone) {
  return Boolean(
    duelModeActive
    && state.pending?.type === "block"
    && state.pending.actorIndex === 0
    && ownerIndex === 0
    && zone === "board"
    && state.pending.blockerIds?.includes(card.id)
  );
}

function currentDimmedCardIds() {
  const ids = new Set();
  if (drOrangeChoicePrompt?.cardId) {
    for (const player of state.players) {
      for (const card of player.board) {
        if (card.id !== drOrangeChoicePrompt.cardId) ids.add(card.id);
      }
    }
  }
  if (earwigChoicePrompt?.cardId) {
    for (const player of state.players) {
      for (const card of player.board) {
        if (card.id !== earwigChoicePrompt.cardId) ids.add(card.id);
      }
    }
  }
  if (utilityKeywordSelection) {
    for (const player of state.players) {
      for (const card of player.board) {
        const isSource = card.id === utilityKeywordSelection.sourceCard?.id;
        const isCandidate = utilityKeywordSelection.cardIds.has(card.id);
        if (!isSource && !isCandidate) ids.add(card.id);
      }
    }
  }
  if (pendingMindbug?.cardId) {
    for (const player of state.players) {
      for (const card of player.board) {
        if (card.id !== pendingMindbug.cardId) ids.add(card.id);
      }
    }
  }
  const attackIntentState = attackIntentAnimationState();
  if (attackIntentState) {
    const owner = state.players[attackIntentState.data.ownerIndex];
    for (const card of owner.board) {
      if (card.id !== attackIntentState.cardId) ids.add(card.id);
    }
  }
  if (defeatSelection) {
    for (const player of state.players) {
      for (const card of player.board) {
        const isTargetCandidate = defeatSelection.cardIds.has(card.id)
          && (defeatSelection.ownerIndex === null || state.players[defeatSelection.ownerIndex]?.board.includes(card));
        const isSourceCard = card.id === defeatSelection.sourceCard?.id;
        if (!isTargetCandidate && !isSourceCard) ids.add(card.id);
      }
    }
  }
  if (disableBlockSelection) {
    for (const player of state.players) {
      for (const card of player.board) {
        const isTargetCandidate = disableBlockSelection.cardIds.has(card.id)
          && state.players[disableBlockSelection.ownerIndex]?.board.includes(card);
        const isSourceCard = card.id === disableBlockSelection.sourceCard?.id;
        if (!isTargetCandidate && !isSourceCard) ids.add(card.id);
      }
    }
  }
  if (stealSelection) {
    for (const player of state.players) {
      for (const card of player.board) {
        const isTargetCandidate = stealSelection.cardIds.has(card.id) && state.players[stealSelection.ownerIndex]?.board.includes(card);
        const isSourceCard = card.id === stealSelection.sourceCard?.id;
        if (!isTargetCandidate && !isSourceCard) ids.add(card.id);
      }
    }
  }
  if (discardSelection) {
    for (const player of state.players) {
      for (const card of player.board) {
        if (card.id !== discardSelection.sourceCard?.id) ids.add(card.id);
      }
    }
  }
  if (hunterTargetSelection) {
    for (const player of state.players) {
      for (const card of player.board) {
        const isTargetCandidate = hunterTargetSelection.cardIds.has(card.id) && state.players[hunterTargetSelection.ownerIndex]?.board.includes(card);
        const isSourceCard = card.id === hunterTargetSelection.attacker?.id;
        if (!isTargetCandidate && !isSourceCard) ids.add(card.id);
      }
    }
  }
  if (duelModeActive && duelBlockSelectionMode && state.pending?.type === "block" && state.pending.actorIndex === 0) {
    const blockerIds = new Set(state.pending.blockerIds ?? []);
    for (const card of state.players[0]?.board ?? []) {
      if (!blockerIds.has(card.id)) ids.add(card.id);
    }
  }
  const duelSourceId = duelPendingSourceCardId();
  if (duelSourceId) {
    const targetIds = duelPendingSourceTargetIds();
    for (const player of state.players) {
      for (const card of player.board) {
        if (card.id !== duelSourceId && !targetIds.has(card.id)) ids.add(card.id);
      }
    }
  }
  return ids;
}

function syncDimmedCardTransitions() {
  const current = currentDimmedCardIds();
  enteringDimmedCardIds.clear();
  for (const id of current) {
    if (!activeDimmedCardIds.has(id)) enteringDimmedCardIds.add(id);
    fadingDimmedCardIds.delete(id);
  }
  for (const id of activeDimmedCardIds) {
    if (!current.has(id)) fadingDimmedCardIds.add(id);
  }
  activeDimmedCardIds.clear();
  for (const id of current) activeDimmedCardIds.add(id);
  if (fadingDimmedCardIds.size) {
    window.clearTimeout(dimFadeTimer);
    dimFadeTimer = window.setTimeout(() => {
      fadingDimmedCardIds.clear();
      render();
    }, motionMs(180));
  }
}

function render() {
  syncDuelHunterTargetSelection();
  renderOpponentHand();
  renderScoreboard();
  renderArena();
  renderHand();
  renderHandActionPanels();
  renderDebugPanel();
  const player = currentPlayer();
  if (els.statusText) {
    els.statusText.textContent = hasWinner()
      ? `${state.players[state.winner].name} thắng ván này.`
      : duelModeActive && state.pending?.type === "mindbug"
        ? "Chọn Cướp hoặc Không."
      : duelModeActive && state.pending?.type === "block" && state.pending.actorIndex === 0 && !duelBlockSelectionMode
        ? "Chọn Chặn hoặc Không."
      : duelModeActive && state.pending?.type === "block" && state.pending.actorIndex === 0
        ? "Chọn một Quái vật trên sân của bạn để chặn."
      : duelModeActive && state.pending?.type === "frenzy" && state.pending.actorIndex === 0
        ? "Chọn có tấn công lần 2 hay không."
      : duelModeActive && state.pending?.type === "hunter" && state.pending.actorIndex === 0 && !duelHunterTargetSelectionMode
        ? "Chọn HUNTER tấn công trực tiếp hoặc Quái vật."
      : duelModeActive && state.pending?.type === "hunter" && state.pending.actorIndex === 0
        ? "Chọn Quái vật bị HUNTER tấn công."
      : duelModeActive && state.pending?.type === "discard" && state.pending.actorIndex === 0
        ? "Chọn một lá trên tay để bỏ."
      : duelModeActive && state.pending?.type === "discard-pile" && state.pending.actorIndex === 0
        ? "Chọn Quái vật trong Mộ bài."
      : duelModeActive && state.pending?.type === "defeat" && state.pending.actorIndex === 0
        ? "Chọn Quái vật để hạ."
      : duelModeActive && state.pending?.type === "steal" && state.pending.actorIndex === 0
        ? "Chọn Quái vật để cướp."
      : duelModeActive && state.pending
        ? "Đang chờ đối thủ ra quyết định."
      : pendingMindbug
        ? "Chọn Mindbug hoặc Không."
      : discardSelection
        ? "Chọn một lá trên tay để bỏ."
      : discardPileSelection
        ? "Chọn Quái vật để hồi sinh."
      : defeatSelection
        ? "Chọn một Quái vật đối thủ để hạ."
      : disableBlockSelection
        ? "Chọn Quái vật không thể chặn."
      : stealSelection
        ? "Chọn một Quái vật đối thủ để cướp."
      : hunterAttackPrompt
        ? "Chọn HUNTER tấn công đối thủ hoặc Quái vật."
      : frenzySecondAttackPrompt
        ? "Chọn có tấn công lần 2 bằng Quái vật ĐÁNH 2 LẦN hay không."
      : hunterTargetSelection
        ? "Chọn Quái vật bị HUNTER tấn công."
      : blockPrompt
        ? "Chọn Chặn hoặc Không."
      : blockSelection
        ? "Chọn một Quái vật trên sân của bạn để chặn."
      : state.active === BOT_INDEX
        ? "Bot đang quan sát bàn đấu và sẽ tự ra hành động."
      : state.frenzyOnly
        ? `${player.name} có thể tấn công lần hai bằng Quái vật ĐÁNH 2 LẦN.`
      : `${player.name} đang đi: chơi 1 Quái vật hoặc tấn công.`;
  }
}

function renderDebugPanel() {
  els.debugPanel.hidden = !debugOpen;
  if (!debugOpen) return;
  renderDebugControls();
}

function renderDebugControls() {
  if (!els.debugAnimationMode) return;
  els.debugAnimationMode.textContent = `Animation test: ${animationTestMode ? "ON" : "OFF"}`;
  els.debugAnimationMode.classList.toggle("active", animationTestMode);
  renderDebugCardSuggestions();
}

function renderDebugCardSuggestions() {
  if (!els.debugCardSuggestions) return;
  const signature = ALL_CARD_SPECS
    .map(([name]) => `${name}:${CARD_NAME_LABELS[name] ?? name}:${CARD_SPRITE_FILES[name] ?? ""}`)
    .join("|");
  if (els.debugCardSuggestions.dataset.signature === signature) return;
  els.debugCardSuggestions.innerHTML = "";
  for (const spec of ALL_CARD_SPECS) {
    const [name] = spec;
    const viName = CARD_NAME_LABELS[name] ?? name;
    const option = document.createElement("option");
    option.value = viName === name ? name : `${viName} / ${name}`;
    option.label = viName === name ? name : name;
    els.debugCardSuggestions.append(option);
  }
  els.debugCardSuggestions.dataset.signature = signature;
}

function addDebugCardSpecToBoard(playerIndex, spec, note = "") {
  if (!state || hasWinner() || !spec) return null;
  if (duelModeActive) {
    sendDuelAction({
      type: "debug-add-board",
      playerIndex,
      cardName: spec[0],
      triggerPlayAbility: note.includes("play debug")
    });
    return null;
  }
  const card = makeCard(spec);
  card.exhausted = false;
  card.attacksThisTurn = 0;
  card.damage = 0;
  card.originalOwnerIndex = playerIndex;
  state.players[playerIndex].board.push(card);
  log(`Debug: thêm ${displayCardName(card)}${note ? ` ${note}` : ""} lên sân ${state.players[playerIndex].name}.`);
  render();
  return card;
}

function debugAddCreatureToBoard(playerIndex) {
  if (!state || hasWinner()) return;
  const spec = ALL_CARD_SPECS[debugAddCardIndex % ALL_CARD_SPECS.length];
  debugAddCardIndex += 1;
  addDebugCardSpecToBoard(playerIndex, spec);
}

function debugAddKeywordCreatureToBoard(playerIndex, keyword) {
  if (!state || hasWinner()) return;
  const cardName = DEBUG_KEYWORD_CARD_NAMES[keyword];
  const spec = ALL_CARD_SPECS.find(([name]) => name === cardName)
    ?? ALL_CARD_SPECS.find(([, , , keywords]) => keywords.includes(keyword));
  if (!spec) {
    log(`Debug: không tìm thấy lá có keyword ${keyword}.`);
    render();
    return;
  }
  addDebugCardSpecToBoard(playerIndex, spec, `(${keyword})`);
}

function normalizeDebugCardName(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findDebugCardSpec(query) {
  const normalized = normalizeDebugCardName(query);
  if (!normalized) return null;
  const entries = ALL_CARD_SPECS.map(spec => {
    const [name] = spec;
    const viName = CARD_NAME_LABELS[name] ?? name;
    const spriteName = (CARD_SPRITE_FILES[name] ?? "").replace(/\.[^.]+$/, "");
    return {
      spec,
      names: [name, viName, `${viName} / ${name}`, spriteName].map(normalizeDebugCardName)
    };
  });
  return entries.find(entry => entry.names.some(name => name === normalized))?.spec
    ?? entries.find(entry => entry.names.some(name => name.includes(normalized)))?.spec
    ?? null;
}

async function debugAddNamedCardToBoard(playerIndex) {
  if (!state || hasWinner()) return;
  const spec = findDebugCardSpec(els.debugCardSearch?.value ?? "");
  if (!spec) {
    log("Debug: không tìm thấy lá bài theo tên đã nhập.");
    render();
    return;
  }
  const card = addDebugCardSpecToBoard(playerIndex, spec, "(play debug)");
  if (!card) return;
  const opponentIndex = 1 - playerIndex;
  const opponent = state.players[opponentIndex];
  if (canUseMindbug(card, "hand", opponent)) {
    const choice = await waitForMindbugDecision(card, playerIndex, opponentIndex);
    if (choice === "steal") {
      const sourceRect = measureBoardSlotRect(card.id);
      state.players[playerIndex].board = state.players[playerIndex].board.filter(boardCard => boardCard.id !== card.id);
      opponent.mindbugs -= 1;
      card.mindbuggedThisTurn = true;
      opponent.board.push(card);
      suppressedBoardEnterCardIds.add(card.id);
      hiddenMindbugTravelCardIds.add(card.id);
      showRemoteMessage("CƯỚP", "");
      log(`${opponent.name} dùng Mindbug và cướp ${card.name}.`);
      render();
      await animateMindbugSteal(card, sourceRect);
      await resolvePlayAbility(card, opponentIndex);
      checkGameOver();
      render();
      return;
    }
  }
  await resolvePlayAbility(card, playerIndex);
  checkGameOver();
  render();
}

function debugDrawToHand(playerIndex) {
  if (!state || hasWinner()) return;
  const player = state.players[playerIndex];
  const card = player.deck.shift() ?? makeCard(RAW_CARDS[debugAddCardIndex++ % RAW_CARDS.length]);
  addCardsToHand(playerIndex, [card]);
  queueDeckDrawFx(playerIndex, 1);
  log(`Debug: ${player.name} rút ${card.name}.`);
  render();
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

async function debugBotRandomAttack() {
  if (!state || hasWinner()) return;
  if (state.phase !== "action") {
    log("Debug: Bot random attack bị bỏ qua vì game đang chờ lựa chọn.");
    render();
    return;
  }
  const attackers = state.players[BOT_INDEX].board.filter(card => canAttack(card, BOT_INDEX));
  if (!attackers.length) {
    log("Debug: Bot không có lá nào để tấn công.");
    render();
    return;
  }
  const picked = randomItem(attackers);
  state.active = BOT_INDEX;
  state.frenzyOnly = null;
  log(`Debug: Bot chọn ngẫu nhiên ${picked.name} để tấn công.`);
  render();
  await attack(picked.id);
}

async function debugPlayerRandomAttack() {
  if (!state || hasWinner()) return;
  if (state.phase !== "action") {
    log("Debug: P1 random attack bị bỏ qua vì game đang chờ lựa chọn.");
    render();
    return;
  }
  const attackerIndex = 0;
  const defenderIndex = 1;
  const attackers = state.players[attackerIndex].board.filter(card => canAttack(card, attackerIndex));
  if (!attackers.length) {
    log("Debug: P1 không có lá nào để tấn công.");
    render();
    return;
  }
  const attacker = randomItem(attackers);
  const targetOptions = [{ type: "face", id: "" }];
  if (cardKeywords(attacker, attackerIndex).includes("HUNTER")) {
    for (const card of state.players[defenderIndex].board) {
      targetOptions.push({ type: "creature", id: card.id });
    }
  }
  const target = randomItem(targetOptions);
  let blockerId = "";
  if (target.type === "face") {
    const blockers = legalBlockers(attacker, attackerIndex, defenderIndex);
    const blockOptions = ["", ...blockers.map(card => card.id)];
    blockerId = randomItem(blockOptions) ?? "";
  }
  debugRandomAttackPlan = {
    attackerId: attacker.id,
    targetCreatureId: target.type === "creature" ? target.id : "",
    blockerId
  };
  state.active = attackerIndex;
  state.frenzyOnly = null;
  log(`Debug: P1 chọn ngẫu nhiên ${attacker.name} để tấn công.`);
  render();
  await attack(attacker.id);
}

function renderDebugPointer() {
  if (!els.debugPointer) return;
  const app = document.querySelector(".app");
  const appRect = app?.getBoundingClientRect();
  const arenaRect = els.arena?.getBoundingClientRect();
  const boardText = arenaRect
    ? `Board Y: top ${Math.round(arenaRect.top)}, bottom ${Math.round(arenaRect.bottom)} | app ${Math.round(arenaRect.top - (appRect?.top ?? 0))}, ${Math.round(arenaRect.bottom - (appRect?.top ?? 0))}`
    : "Board Y: -";
  const targetText = debugTargetCardRect
    ? `Target: ${debugTargetCardRect.name} | x ${debugTargetCardRect.left}-${debugTargetCardRect.right}, y ${debugTargetCardRect.top}-${debugTargetCardRect.bottom} | app ${debugTargetCardRect.appLeft}-${debugTargetCardRect.appRight}, ${debugTargetCardRect.appTop}-${debugTargetCardRect.appBottom}`
    : "Target: -";
  if (!pointerPosition) {
    els.debugPointer.textContent = `Pointer: - | ${boardText} | ${targetText}`;
    return;
  }
  const appX = appRect ? Math.round(pointerPosition.x - appRect.left) : "-";
  const appY = appRect ? Math.round(pointerPosition.y - appRect.top) : "-";
  els.debugPointer.textContent = `Pointer: x ${Math.round(pointerPosition.x)}, y ${Math.round(pointerPosition.y)} | app ${appX}, ${appY} | ${boardText} | ${targetText}`;
}

function trackDebugTargetCard(cardId, name = "lá bài") {
  const cardEl = els.arena?.querySelector(`.fieldCards [data-card-id="${cardId}"]`);
  const appRect = document.querySelector(".app")?.getBoundingClientRect();
  if (!cardEl || !appRect) return;
  const rect = cardEl.getBoundingClientRect();
  debugTargetCardRect = {
    name,
    left: Math.round(rect.left),
    right: Math.round(rect.right),
    top: Math.round(rect.top),
    bottom: Math.round(rect.bottom),
    appLeft: Math.round(rect.left - appRect.left),
    appRight: Math.round(rect.right - appRect.left),
    appTop: Math.round(rect.top - appRect.top),
    appBottom: Math.round(rect.bottom - appRect.top)
  };
  if (debugOpen) renderDebugPointer();
}

function renderScoreboard() {
  els.opponentInfo.innerHTML = "";
  els.playerOneInfo.innerHTML = "";
  els.opponentInfo.append(renderPlayerBox(state.players[1], 1));
  els.playerOneInfo.append(renderPlayerBox(state.players[0], 0));
  els.localHandActions = els.playerOneInfo.querySelector("#localHandActions");
  syncOpponentPendingAbilityPointer();
}

function renderPlayerBox(player, index) {
  const box = document.createElement("article");
  box.className = `playerBox ${index === state.active && !hasWinner() ? "active" : ""}`;
  const controlPanel = index === 0
    ? `<aside class="handActionPanel localHandActionPanel" id="localHandActions"></aside>`
    : `<aside class="handActionPanel opponentInfoActionPanel">${mindbugInfoHtml(player.mindbugs)}</aside>`;
  const deckDrawFx = deckDrawFxItems
    .filter(item => item.playerIndex === index)
    .map(item => `<span class="deckDrawFx" style="animation-delay: ${item.delay}ms" data-deck-fx="${item.id}"></span>`)
    .join("");
  const deckPill = `
    <span class="pill deckPill ${index === 1 ? "opponentDeckPill" : "localDeckPill"} ${player.deck.length ? "" : "empty"}" data-deck-player="${index}" aria-label="Bộ bài còn ${player.deck.length} lá">
      <span class="deckLabel" aria-hidden="true">Bộ bài</span>
      <span class="deckBackStack" aria-hidden="true">
        <span class="deckBackSprite"></span>
        ${deckDrawFx}
      </span>
      <strong class="deckCount">${player.deck.length}</strong>
    </span>
  `;
  const topDiscardCard = player.discard.at(-1);
  const discardPreview = topDiscardCard
    ? renderMiniDiscardSpriteHtml(topDiscardCard, index)
    : `<span class="discardEmptySprite"></span>`;
  const discardButton = `
    <button class="pill discardPileButton ${topDiscardCard ? "" : "empty"}" type="button" data-discard-player="${index}" aria-label="Mộ bài có ${player.discard.length} lá">
      <span class="discardLabel" aria-hidden="true">Mộ bài</span>
      <span class="discardTopStack" aria-hidden="true">
        ${discardPreview}
      </span>
      <strong class="discardCount">${player.discard.length}</strong>
    </button>
  `;
  const statItems = `${controlPanel}${lifeRingHtml(player.life, index, playerAvatars[index])}${deckPill}${discardButton}`;
  box.innerHTML = `
    <div class="statLine">
      ${statItems}
    </div>
  `;
  box.querySelector("[data-discard-player]")?.addEventListener("click", () => openDiscardDialog(index));
  if (index === 0) {
    const localDeck = box.querySelector("[data-deck-player=\"0\"]");
    localDeck?.setAttribute("role", "button");
    localDeck?.setAttribute("tabindex", "0");
    localDeck?.setAttribute("aria-label", `Bộ bài còn ${player.deck.length} lá. Nhấn để đầu hàng.`);
    localDeck?.addEventListener("click", requestSurrender);
    localDeck?.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      requestSurrender();
    });
  }
  return box;
}

function mindbugInfoHtml(count) {
  return `
    <div class="handActionInfo">CƯỚP</div>
    <div class="handActionCount">Còn ${count} lần</div>
  `;
}

function renderMiniDiscardSpriteHtml(card, ownerIndex) {
  const image = cardSpriteUrl(card);
  const style = image ? ` style="--card-front-image: ${image}"` : "";
  return `<span class="discardTopCard"${style}></span>`;
}

function lifeRingHtml(life, playerIndex, avatarId) {
  const safeAvatarId = normalizeAvatarId(avatarId, playerIndex === 0 ? 1 : randomAvatarId(playerAvatars[0]));
  const total = Math.max(STARTING_LIFE, life);
  const active = Math.max(0, Math.min(total, life));
  const color = playerColorConfig(playerIndex);
  const segments = Array.from({ length: total }, (_, index) => {
    const segment = 360 / total;
    const gap = Math.min(segment * 0.56, 18 + Math.max(0, total - STARTING_LIFE) * 3.2);
    const start = -90 + index * segment + gap / 2;
    const end = -90 + (index + 1) * segment - gap / 2;
    const frontClass = index < active ? "lifeRingSegment active" : "lifeRingSegment";
    return `
      <path class="lifeRingSegmentBack" d="${arcPath(31, 31, 25, start, end)}"></path>
      <path class="${frontClass}" d="${arcPath(31, 31, 25, start, end)}" stroke="${index < active ? color.ring : "#66705f"}"></path>
    `;
  }).join("");
  return `
    <span class="pill lifePill" data-life-player="${playerIndex}" style="--life-role-color: ${color.ring}; --life-role-fill: ${color.fill}; --life-role-avatar-bg: ${color.avatarBg}; --life-role-border: ${color.border}">
      <svg class="lifeRing" viewBox="0 0 62 62" aria-hidden="true">${segments}</svg>
      <span class="lifeRingCenter">
        <span class="lifeAvatarFrame" aria-hidden="true">
          <img src="${avatarUrl(safeAvatarId)}" alt="">
        </span>
      </span>
      <span class="lifeCountTag" aria-hidden="true">${Math.max(0, life)}</span>
    </span>
  `;
}

function arcPath(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function polarToCartesian(cx, cy, radius, angle) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians)
  };
}

function currentBoardCardScale() {
  const field = els.arena?.querySelector(".fieldCards");
  const scale = Number.parseFloat(field ? getComputedStyle(field).getPropertyValue("--board-scale") : "");
  return Number.isFinite(scale) && scale > 0 ? scale : 0.72;
}

function openDiscardDialog(playerIndex) {
  if (!els.discardDialog || !els.discardDialogCards) return;
  const player = state.players[playerIndex];
  const appRect = document.querySelector(".app")?.getBoundingClientRect();
  const isSelecting = discardPileSelection?.ownerIndex === playerIndex;
  const arenaRect = els.arena?.getBoundingClientRect();
  const dialogFrameRect = isSelecting && arenaRect ? arenaRect : appRect;
  const maxDialogWidth = Math.max(240, Math.floor((dialogFrameRect?.width ?? window.innerWidth) - 16));
  const maxDialogHeight = Math.max(240, Math.floor((dialogFrameRect?.height ?? window.innerHeight) - 16));
  els.discardDialog.style.setProperty("--discard-dialog-max-width", `${maxDialogWidth}px`);
  els.discardDialog.style.setProperty("--discard-dialog-max-height", `${maxDialogHeight}px`);
  els.discardDialog.style.setProperty("--discard-dialog-left", `${(dialogFrameRect?.left ?? 0) + (dialogFrameRect?.width ?? window.innerWidth) / 2}px`);
  els.discardDialog.style.setProperty("--discard-dialog-top", `${(dialogFrameRect?.top ?? 0) + (dialogFrameRect?.height ?? window.innerHeight) / 2}px`);
  document.querySelector(".app")?.classList.toggle("discardPileSelectionActive", isSelecting);
  els.discardBackdrop?.classList.toggle("discardPileSelectionBackdrop", isSelecting);
  els.discardDialog.classList.toggle("discardPileSelectionDialog", isSelecting);
  if (els.discardDialogClose) els.discardDialogClose.hidden = isSelecting;
  els.discardDialogTitle.textContent = isSelecting ? "Chọn Quái vật để hồi sinh" : "Mộ bài";
  els.discardDialogCards.innerHTML = "";
  els.discardDialogCards.style.setProperty("--discard-card-scale", currentBoardCardScale());
  if (!player.discard.length) {
    const empty = document.createElement("div");
    empty.className = "discardDialogEmpty";
    empty.textContent = "Chưa có Mộ bài";
    els.discardDialogCards.append(empty);
  } else {
    for (const card of player.discard) {
      const slot = document.createElement("div");
      const isCandidate = isSelecting && discardPileSelection.cardIds.has(card.id);
      slot.className = `discardPileCardSlot ${isCandidate ? "discardPileCandidate" : ""}`;
      const cardEl = document.createElement("article");
      cardEl.className = "card discardPileCard";
      if (inspectedDiscardPileCardId === card.id) cardEl.classList.add("selectedCard");
      cardEl.dataset.cardId = card.id;
      applyCardSprite(cardEl, card);
      cardEl.innerHTML = cardFaceHtml(card, cardPower(card, playerIndex), cardKeywords(card, playerIndex), "discard", playerIndex);
      slot.addEventListener("click", event => {
        event.stopPropagation();
        inspectCard(card, playerIndex, "discard", cardEl);
      });
      slot.append(cardEl);
      els.discardDialogCards.append(slot);
    }
  }
  showDiscardDialog();
}

function showDiscardDialog() {
  if (!els.discardDialog) return;
  if (els.discardBackdrop) els.discardBackdrop.hidden = false;
  if (!els.discardDialog.open) els.discardDialog.show();
}

function closeDiscardDialog({ force = false } = {}) {
  if (discardPileSelection && !force) return;
  els.discardDialog?.close();
  els.discardDialog?.classList.remove("discardPileSelectionDialog");
  document.querySelector(".app")?.classList.remove("discardPileSelectionActive");
  els.discardBackdrop?.classList.remove("discardPileSelectionBackdrop");
  if (els.discardDialogClose) els.discardDialogClose.hidden = false;
  if (els.discardBackdrop) els.discardBackdrop.hidden = true;
}

function renderArena() {
  syncDimmedCardTransitions();
  els.arena.innerHTML = "";
  clearAttackIntentLayer();
  let attackIntent = null;
  [1, 0].forEach((playerIndex, slot) => {
    const player = state.players[playerIndex];
    const boardLayoutKey = `board-${playerIndex}`;
    const previousLayout = handLayoutSnapshot(boardLayoutKey);
    const section = document.createElement("section");
    section.className = `battlefield ${slot === 0 ? "enemy" : "ally"}`;
    const cards = document.createElement("div");
    cards.className = "fieldCards";
    section.append(cards);
    els.arena.append(section);
    const boardScale = Number.parseFloat(boardCardScale(player.board.length, cards));
    cards.style.setProperty("--board-scale", boardScale.toFixed(3));
    cards.style.setProperty("--board-card-width", `${(CARD_BASE_WIDTH * boardScale).toFixed(2)}px`);
    cards.style.setProperty("--board-card-height", `${(CARD_BASE_HEIGHT * boardScale).toFixed(2)}px`);
    cards.style.setProperty("--board-max-width", `${((CARD_BASE_WIDTH * boardScale * BOARD_ROW_CAPACITY) + ((BOARD_ROW_CAPACITY - 1) * 3)).toFixed(2)}px`);
    if (player.board.length) {
      for (const card of player.board) {
        const slot = document.createElement("div");
        slot.className = "fieldCardSlot";
        slot.dataset.cardId = card.id;
        const cardEl = renderCard(card, playerIndex, "board");
        if (isCardAnimationState(card.id, CARD_ANIMATION_STATE.ATTACK_INTENT)) {
          cardEl.classList.add("attackIntentSourceHidden");
          attackIntent = { card, ownerIndex: playerIndex };
        }
        slot.append(cardEl);
        cards.append(slot);
      }
    }
    animateBoardLayout(cards, previousLayout, boardLayoutKey);
    if (slot === 0) {
      const isGameOver = hasWinner();
      const turnPointerActive = isGameOver ? state.winner : turnPointerTargetIndex();
      let turnPointerChanged = false;
      if (lastTurnPointerActive === null && turnPointerActive !== null) {
        lastTurnPointerActive = turnPointerActive;
      } else if (turnPointerActive !== null && lastTurnPointerActive !== turnPointerActive) {
        turnPointerChanged = true;
        lastTurnPointerActive = turnPointerActive;
      }
      const turnPointerClass = turnPointerActive === 1
        ? "playerTwoTurn"
        : turnPointerActive === 0
          ? "playerOneTurn"
          : "noTurn";
      const messageRow = document.createElement("section");
      messageRow.className = `remoteMessageRow ${turnPointerClass} ${isGameOver ? "gameOverMessageRow" : ""}`;
      if (turnPointerActive !== null && turnPointerActive !== undefined) {
        const color = playerColorConfig(turnPointerActive);
        messageRow.style.setProperty("--turn-pointer-color", color.ring);
        messageRow.style.setProperty("--turn-row-fill", color.fill);
      }
      const leftIndicator = renderTurnPointerCell();
      const centerCell = document.createElement("div");
      centerCell.className = "remoteMessageCell";
      const rightIndicator = renderTurnPointerCell();
      centerCell.append(els.remoteMessage);
      messageRow.append(leftIndicator, centerCell, rightIndicator);
      els.arena.append(messageRow);
      if (turnPointerChanged) {
        window.requestAnimationFrame(() => animateTurnPointers(messageRow, turnPointerActive));
      }
    }
  });
  if (attackIntent) {
    renderAttackIntentLayer(attackIntent.card, attackIntent.ownerIndex);
  }
}

function turnPointerTargetIndex() {
  if (hasWinner()) return null;
  if (duelModeActive && state.pending?.actorIndex !== undefined) return state.pending.actorIndex;
  if (pendingMindbug?.actorIndex !== undefined) return pendingMindbug.actorIndex;
  if (blockPrompt?.defenderIndex !== undefined) return blockPrompt.defenderIndex;
  if (hunterAttackPrompt?.actorIndex !== undefined) return hunterAttackPrompt.actorIndex;
  if (hunterTargetSelection?.actorIndex !== undefined) return hunterTargetSelection.actorIndex;
  if (frenzySecondAttackPrompt?.actorIndex !== undefined) return frenzySecondAttackPrompt.actorIndex;
  if (defeatSelection?.actorIndex !== undefined) return defeatSelection.actorIndex;
  if (disableBlockSelection?.actorIndex !== undefined) return disableBlockSelection.actorIndex;
  if (stealSelection?.actorIndex !== undefined) return stealSelection.actorIndex;
  if (discardPileSelection?.actorIndex !== undefined) return discardPileSelection.actorIndex;
  if (blockSelection?.ownerIndex !== undefined) return blockSelection.ownerIndex;
  if (choicePromptActorIndex !== null && choicePromptActorIndex !== undefined) return choicePromptActorIndex;
  return state.active;
}

function renderTurnPointerCell() {
  const cell = document.createElement("div");
  cell.className = "turnPointerCell";
  const shadow = document.createElement("span");
  shadow.className = "turnPointerTriangleShadow";
  shadow.innerHTML = `
    <svg viewBox="0 0 32 28" aria-hidden="true" focusable="false">
      <path class="turnPointerTriangleShadowShape" d="M5 3 Q3 3 4.2 5.2 L14.1 23 Q16 26.4 17.9 23 L27.8 5.2 Q29 3 27 3 Z"></path>
    </svg>
  `;
  const triangle = document.createElement("span");
  triangle.className = "turnPointerTriangle";
  triangle.innerHTML = `
    <svg viewBox="0 0 32 28" aria-hidden="true" focusable="false">
      <path class="turnPointerTriangleShape" d="M5 3 Q3 3 4.2 5.2 L14.1 23 Q16 26.4 17.9 23 L27.8 5.2 Q29 3 27 3 Z"></path>
    </svg>
  `;
  cell.append(shadow, triangle);
  return cell;
}

function animateTurnPointers(row, activePlayerIndex) {
  const triangles = [...row.querySelectorAll(".turnPointerTriangle")];
  const shadows = [...row.querySelectorAll(".turnPointerTriangleShadow")];
  if (!triangles.length) return;
  const frames = activePlayerIndex === 1
    ? [
      { transform: "rotate(0deg)" },
      { transform: "rotate(186deg)", offset: 0.8 },
      { transform: "rotate(178deg)", offset: 0.92 },
      { transform: "rotate(180deg)" }
    ]
    : [
      { transform: "rotate(180deg)" },
      { transform: "rotate(-6deg)", offset: 0.8 },
      { transform: "rotate(2deg)", offset: 0.92 },
      { transform: "rotate(0deg)" }
    ];
  const shadowFrames = activePlayerIndex === 1
    ? [
      { transform: "translate(-50%, calc(-50% + 6px)) rotate(0deg)" },
      { transform: "translate(-50%, calc(-50% + 6px)) rotate(186deg)", offset: 0.8 },
      { transform: "translate(-50%, calc(-50% + 6px)) rotate(178deg)", offset: 0.92 },
      { transform: "translate(-50%, calc(-50% + 6px)) rotate(180deg)" }
    ]
    : [
      { transform: "translate(-50%, calc(-50% + 6px)) rotate(180deg)" },
      { transform: "translate(-50%, calc(-50% + 6px)) rotate(-6deg)", offset: 0.8 },
      { transform: "translate(-50%, calc(-50% + 6px)) rotate(2deg)", offset: 0.92 },
      { transform: "translate(-50%, calc(-50% + 6px)) rotate(0deg)" }
    ];
  for (const triangle of triangles) {
    triangle.animate(frames, {
      duration: motionMs(300),
      easing: "cubic-bezier(.2, .85, .18, 1)",
      fill: "both"
    });
  }
  for (const shadow of shadows) {
    shadow.animate(shadowFrames, {
      duration: motionMs(300),
      easing: "cubic-bezier(.2, .85, .18, 1)",
      fill: "both"
    });
  }
}

function renderOpponentHand() {
  if (!els.opponentHand) return;
  const previousLayout = handLayoutSnapshot("opponent");
  els.opponentHand.innerHTML = "";
  const hand = state.players[BOT_INDEX].hand;
  const row = document.createElement("div");
  row.className = "opponentHandRow";
  for (let index = 0; index < hand.length; index += 1) {
    const back = document.createElement("div");
    back.className = "cardBack";
    back.dataset.cardId = `opponent-hand-slot-${opponentHandSlotOffset + index}`;
    setHandFanVars(back, index, hand.length, row);
    back.setAttribute("aria-label", "Lá bài úp của Người chơi 2");
    row.append(back);
  }
  els.opponentHand.append(row);
  animateHandLayout(row, previousLayout, ".cardBack", "top", "opponent");
  renderOpponentPendingAbilityOverlay();
}

function renderOpponentPendingAbilityOverlay() {
  if (!els.opponentPendingAbilityOverlay) return;
  const pendingInfo = opponentPendingAbilityInfo();
  if (pendingInfo) opponentAbilityMessage = pendingInfo;
  const info = pendingInfo ?? opponentAbilityMessage;
  els.opponentPendingAbilityOverlay.hidden = !info;
  if (!info) return;
  els.opponentPendingAbilityTitle.textContent = info.title;
  els.opponentPendingAbilityText.innerHTML = formatAbilityHtml(info.text);
  syncOpponentPendingAbilityPointer();
}

function syncOpponentPendingAbilityPointer() {
  const overlay = els.opponentPendingAbilityOverlay;
  if (!overlay || overlay.hidden) return;
  const target = els.opponentInfo?.querySelector(".lifePill[data-life-player=\"1\"]");
  const overlayRect = overlay.getBoundingClientRect();
  const targetRect = target?.getBoundingClientRect();
  if (!overlayRect.width || !targetRect) {
    overlay.style.setProperty("--pending-pointer-x", "50%");
    return;
  }
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const pointerX = Math.max(0, Math.min(overlayRect.width, targetCenterX - overlayRect.left));
  overlay.style.setProperty("--pending-pointer-x", `${pointerX.toFixed(1)}px`);
}

function measureOpponentLeftmostHandCardRect() {
  const backs = [...(els.opponentHand?.querySelectorAll(".cardBack") ?? [])]
    .filter(cardEl => cardEl.isConnected);
  if (!backs.length) return null;
  return backs
    .map(cardEl => cardEl.getBoundingClientRect())
    .sort((a, b) => a.left - b.left)[0];
}

async function animateCardReturnToHand(cardId, handOwnerIndex) {
  const source = els.arena?.querySelector(`.fieldCards .card[data-card-id="${cardId}"]`);
  const app = document.querySelector(".app");
  if (!source || !app) {
    await wait(motionMs(90));
    return;
  }
  const appRect = app.getBoundingClientRect();
  const sourceRect = source.getBoundingClientRect();
  const handRect = handOwnerIndex === BOT_INDEX
    ? (els.opponentHand?.getBoundingClientRect() ?? sourceRect)
    : (els.hand?.getBoundingClientRect() ?? sourceRect);
  const clone = source.cloneNode(true);
  clone.classList.add("cardTopLayerCard");
  clone.querySelectorAll(
    ".effectTags, .abilityBlockedMark, .cardTopline, .keywords, .ability, .abilityWarning, .muted, .cardActions"
  ).forEach(element => element.remove());
  clone.style.position = "absolute";
  clone.style.left = `${sourceRect.left - appRect.left}px`;
  clone.style.top = `${sourceRect.top - appRect.top}px`;
  clone.style.width = `${sourceRect.width}px`;
  clone.style.height = `${sourceRect.height}px`;
  clone.style.minWidth = "0";
  clone.style.minHeight = "0";
  clone.style.maxWidth = `${sourceRect.width}px`;
  clone.style.maxHeight = `${sourceRect.height}px`;
  clone.style.boxSizing = "border-box";
  clone.style.overflow = "hidden";
  clone.style.transform = "none";
  clone.style.transformOrigin = "center";
  clone.style.zIndex = "82";
  clone.style.pointerEvents = "none";
  app.append(clone);
  source.style.opacity = "0";
  const direction = handOwnerIndex === BOT_INDEX ? -1 : 1;
  const targetX = handRect.left + handRect.width / 2 - (sourceRect.left + sourceRect.width / 2);
  const targetY = direction * Math.min(72, Math.max(34, Math.abs(handRect.top - sourceRect.top) * .28));
  const animation = clone.animate([
    { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
    { opacity: .72, transform: `translate3d(${targetX * .18}px, ${targetY}px, 0) scale(.94)` },
    { opacity: 0, transform: `translate3d(${targetX * .32}px, ${targetY * 1.35}px, 0) scale(.86)` }
  ], {
    duration: motionMs(360),
    easing: "cubic-bezier(.22,.72,.18,1)",
    fill: "forwards"
  });
  await animation.finished.catch(() => {});
  clone.remove();
}

function renderHandActionPanels() {
  renderOpponentHandActions();
  renderLocalHandActions();
}

function renderOpponentHandActions() {
  if (!els.opponentHandActions) return;
  els.opponentHandActions.innerHTML = "";
}

function renderLocalHandActions() {
  if (!els.localHandActions) return;
  els.localHandActions.innerHTML = "";
  const local = state.players[0];
  if (drOrangeChoicePrompt?.actorIndex === 0) {
    appendHandActionButton(els.localHandActions, "Kích hoạt năng lực", "primary", () => finishDrOrangeChoice(true));
    appendHandActionButton(els.localHandActions, "Không", "secondary", () => finishDrOrangeChoice(false));
    return;
  }
  if (earwigChoicePrompt?.actorIndex === 0) {
    const canActivate = Boolean(state.players[0]?.hand.length && state.players[1]?.board.length);
    appendHandActionButton(els.localHandActions, "Kích hoạt năng lực", "primary", canActivate ? () => finishEarwigChoice(true) : null, !canActivate);
    appendHandActionButton(els.localHandActions, "Không", "secondary", () => finishEarwigChoice(false));
    return;
  }
  if (!duelModeActive && receivedCardChoicePrompt?.actorIndex === 0) {
    appendHandActionButton(els.localHandActions, "Chơi", "primary", () => resolveReceivedCardChoicePrompt("play"));
    appendHandActionButton(els.localHandActions, "Giữ", "secondary", () => resolveReceivedCardChoicePrompt("keep"));
    return;
  }
  if (!duelModeActive && hyenixChoicePrompt?.actorIndex === 0) {
    appendHandActionButton(els.localHandActions, "Chơi", "primary", () => resolveHyenixChoicePrompt("play"));
    appendHandActionButton(els.localHandActions, "Không", "secondary", () => resolveHyenixChoicePrompt("skip"));
    return;
  }
  if (duelModeActive && state.pending?.actorIndex === 0) {
    if (state.pending.type === "mindbug") {
      appendHandActionButton(els.localHandActions, `CƯỚP ${local.mindbugs}`, "primary", () => sendDuelAction({ type: "mindbug-choice", choice: "steal" }), local.mindbugs <= 0);
      appendHandActionButton(els.localHandActions, "Không", "secondary", () => sendDuelAction({ type: "mindbug-choice", choice: "pass" }));
      return;
    }
    if (state.pending.type === "block") {
      if (!duelBlockSelectionMode) {
        appendHandActionButton(els.localHandActions, "Chặn", "primary", () => {
          duelBlockSelectionMode = true;
          render();
        });
        appendHandActionButton(els.localHandActions, "Không", "secondary", () => sendDuelAction({ type: "block-choice", blockerId: "" }));
        return;
      }
      const blockerIds = new Set(state.pending.blockerIds ?? []);
      const selectedBlockerId = blockerIds.has(inspectedLocalBoardCardId) ? inspectedLocalBoardCardId : "";
      appendHandActionButton(els.localHandActions, "Chọn", "primary", selectedBlockerId ? async () => {
        await closeInspectDialogWithAnimation();
        sendDuelAction({ type: "block-choice", blockerId: selectedBlockerId });
      } : null, !selectedBlockerId);
      appendHandActionButton(els.localHandActions, "Không", "secondary", () => sendDuelAction({ type: "block-choice", blockerId: "" }));
      return;
    }
    if (state.pending.type === "frenzy") {
      appendHandActionButton(els.localHandActions, "Tấn công lần 2", "primary", () => sendDuelAction({ type: "frenzy-choice", choice: "again" }));
      appendHandActionButton(els.localHandActions, "Không", "secondary", () => sendDuelAction({ type: "frenzy-choice", choice: "stop" }));
      return;
    }
    if (state.pending.type === "hunter") {
      if (state.pending.mustTargetCreature) {
        const targetIds = new Set(state.pending.targetIds ?? []);
        const selectedTargetId = targetIds.has(inspectedLocalBoardCardId) ? inspectedLocalBoardCardId : "";
        appendHandActionButton(els.localHandActions, "Chọn", "primary", selectedTargetId ? async () => {
          await closeInspectDialogWithAnimation();
          sendDuelAction({ type: "hunter-choice", choice: "creature", cardId: selectedTargetId });
        } : null, !selectedTargetId);
        return;
      }
      if (!duelHunterTargetSelectionMode) {
        appendHandActionButton(els.localHandActions, "Trực tiếp", "primary", () => sendDuelAction({ type: "hunter-choice", choice: "face" }));
        appendHandActionButton(els.localHandActions, "Quái vật", "primary", () => {
          duelHunterTargetSelectionMode = true;
          render();
        });
        return;
      }
      const targetIds = new Set(state.pending.targetIds ?? []);
      const selectedTargetId = targetIds.has(inspectedLocalBoardCardId) ? inspectedLocalBoardCardId : "";
      appendHandActionButton(els.localHandActions, "Chọn", "primary", selectedTargetId ? async () => {
        await closeInspectDialogWithAnimation();
        sendDuelAction({ type: "hunter-choice", choice: "creature", cardId: selectedTargetId });
      } : null, !selectedTargetId);
      appendHandActionButton(els.localHandActions, "Trực tiếp", "secondary", () => sendDuelAction({ type: "hunter-choice", choice: "face" }));
      return;
    }
    if (state.pending.type === "discard") {
      const selectedDiscardId = discardSelection?.cardIds.has(inspectedLocalHandCardId) ? inspectedLocalHandCardId : "";
      appendHandActionButton(els.localHandActions, "Bỏ", "primary", selectedDiscardId ? async () => {
        await closeInspectDialogWithAnimation();
        sendDuelAction({ type: "discard-choice", cardId: selectedDiscardId });
      } : null, !selectedDiscardId);
      return;
    }
    if (state.pending.type === "give-card") {
      const selectedCardId = discardSelection?.cardIds.has(inspectedLocalHandCardId) ? inspectedLocalHandCardId : "";
      appendHandActionButton(els.localHandActions, "Đưa", "primary", selectedCardId ? async () => {
        await closeInspectDialogWithAnimation();
        sendDuelAction({ type: "give-card-choice", cardId: selectedCardId });
      } : null, !selectedCardId);
      return;
    }
    if (state.pending.type === "received-card") {
      appendHandActionButton(els.localHandActions, "Chơi", "primary", async () => {
        await closeInspectDialogWithAnimation();
        clearReceivedCardOverlayState({ reveal: false });
        sendDuelAction({ type: "received-card-choice", choice: "play" });
      });
      appendHandActionButton(els.localHandActions, "Giữ", "secondary", async () => {
        await closeInspectDialogWithAnimation();
        clearReceivedCardOverlayState({ reveal: true });
        renderHand();
        sendDuelAction({ type: "received-card-choice", choice: "keep" });
      });
      return;
    }
    if (state.pending.type === "hyenix") {
      appendHandActionButton(els.localHandActions, "Chơi", "primary", async () => {
        await closeHyenixChoiceOverlay(state.pending.playerIndex);
        sendDuelAction({ type: "hyenix-choice", choice: "play" });
      });
      appendHandActionButton(els.localHandActions, "Không", "secondary", async () => {
        await closeHyenixChoiceOverlay(state.pending.playerIndex);
        sendDuelAction({ type: "hyenix-choice", choice: "skip" });
      });
      return;
    }
    if (state.pending.type === "discard-pile") {
      const selectedDiscardPileId = discardPileSelection?.cardIds.has(inspectedDiscardPileCardId) ? inspectedDiscardPileCardId : "";
      appendHandActionButton(els.localHandActions, "Chọn", "primary", selectedDiscardPileId ? () => {
        sendDuelDiscardPileChoice(selectedDiscardPileId);
      } : null, !selectedDiscardPileId);
      return;
    }
    if (state.pending.type === "defeat") {
      const selectedTargetId = defeatSelection?.cardIds.has(inspectedLocalBoardCardId) ? inspectedLocalBoardCardId : "";
      appendHandActionButton(els.localHandActions, "Chọn", "primary", selectedTargetId ? async () => {
        await closeInspectDialogWithAnimation();
        sendDuelAction({ type: "defeat-choice", cardId: selectedTargetId });
      } : null, !selectedTargetId);
      if (state.pending.allowSkip) {
        appendHandActionButton(els.localHandActions, "Không", "secondary", () => sendDuelAction({ type: "defeat-choice", cardId: "" }));
      }
      return;
    }
    if (state.pending.type === "forced-attack") {
      const selectedTargetId = defeatSelection?.cardIds.has(inspectedLocalBoardCardId) ? inspectedLocalBoardCardId : "";
      appendHandActionButton(els.localHandActions, "Chọn", "primary", selectedTargetId ? async () => {
        await closeInspectDialogWithAnimation();
        sendDuelAction({ type: "forced-attack-choice", cardId: selectedTargetId });
      } : null, !selectedTargetId);
      return;
    }
    if (state.pending.type === "disable-block") {
      const selectedTargetId = disableBlockSelection?.cardIds.has(inspectedLocalBoardCardId) ? inspectedLocalBoardCardId : "";
      appendHandActionButton(els.localHandActions, "Chọn", "primary", selectedTargetId ? async () => {
        await closeInspectDialogWithAnimation();
        sendDuelAction({ type: "disable-block-choice", cardId: selectedTargetId });
      } : null, !selectedTargetId);
      return;
    }
    if (state.pending.type === "steal" || state.pending.type === "experiment") {
      const selectedTargetId = stealSelection?.cardIds.has(inspectedLocalBoardCardId) ? inspectedLocalBoardCardId : "";
      appendHandActionButton(els.localHandActions, "Chọn", "primary", selectedTargetId ? async () => {
        await closeInspectDialogWithAnimation();
        sendDuelAction({
          type: state.pending.type === "experiment" ? "experiment-choice" : "steal-choice",
          cardId: selectedTargetId
        });
      } : null, !selectedTargetId);
      if (state.pending.allowSkip) {
        appendHandActionButton(els.localHandActions, "Không", "secondary", () => sendDuelAction({ type: "steal-choice", cardId: "" }));
      }
      return;
    }
    if (state.pending.type === "utility-play") {
      const selectedTargetId = utilityKeywordSelection?.cardIds.has(inspectedLocalBoardCardId)
        ? inspectedLocalBoardCardId
        : "";
      appendHandActionButton(els.localHandActions, "Chọn", "primary", selectedTargetId ? async () => {
        await closeInspectDialogWithAnimation();
        sendDuelAction({ type: "utility-play-choice", cardId: selectedTargetId });
      } : null, !selectedTargetId);
      return;
    }
  }
  if (pendingMindbug?.actorIndex === 0) {
    if (pendingMindbug.playedByIndex === 0) {
      appendHandActionButton(els.localHandActions, `CƯỚP ${local.mindbugs}`, "primary", null, true);
      return;
    }
    appendHandActionButton(els.localHandActions, `CƯỚP ${local.mindbugs}`, "primary", () => resolvePendingMindbugDecision("steal"));
    appendHandActionButton(els.localHandActions, "Không", "secondary", () => resolvePendingMindbugDecision("pass"));
    return;
  }
  if (blockPrompt?.defenderIndex === 0) {
    appendHandActionButton(els.localHandActions, "Chặn", "primary", () => resolveBlockPrompt("block"));
    appendHandActionButton(els.localHandActions, "Không", "secondary", () => resolveBlockPrompt(""));
    return;
  }
  if (hunterAttackPrompt?.actorIndex === 0) {
    appendHandActionButton(els.localHandActions, "Trực tiếp", "primary", () => resolveHunterAttackPrompt("face"));
    appendHandActionButton(els.localHandActions, "Quái vật", "primary", () => resolveHunterAttackPrompt("creature"));
    return;
  }
  if (frenzySecondAttackPrompt?.actorIndex === 0) {
    const ready = frenzySecondAttackPrompt.ready;
    appendHandActionButton(els.localHandActions, "Tấn công lần 2", "primary", ready ? () => resolveFrenzySecondAttackPrompt("again") : null, !ready);
    appendHandActionButton(els.localHandActions, "Không", "secondary", ready ? () => resolveFrenzySecondAttackPrompt("stop") : null, !ready);
    return;
  }
  if (blockSelection?.ownerIndex === 0) {
    const selectedBlockerId = blockSelection.cardIds.has(inspectedLocalBoardCardId)
      ? inspectedLocalBoardCardId
      : "";
    appendHandActionButton(els.localHandActions, "Chọn", "primary", selectedBlockerId ? async () => {
      await closeInspectDialogWithAnimation();
      finishBlockSelection(selectedBlockerId);
    } : null, !selectedBlockerId);
    return;
  }
  if (discardSelection?.ownerIndex === 0) {
    const selectedDiscardId = discardSelection.cardIds.has(inspectedLocalHandCardId)
      ? inspectedLocalHandCardId
      : "";
    appendHandActionButton(els.localHandActions, discardSelection.actionLabel || "Bỏ", "primary", selectedDiscardId ? async () => {
      await closeInspectDialogWithAnimation();
      finishDiscardSelection(selectedDiscardId);
    } : null, !selectedDiscardId);
    return;
  }
  if (discardPileSelection?.actorIndex === 0) {
    const selectedDiscardPileId = discardPileSelection.cardIds.has(inspectedDiscardPileCardId)
      ? inspectedDiscardPileCardId
      : "";
    appendHandActionButton(els.localHandActions, "Chọn", "primary", selectedDiscardPileId ? () => {
      closeInspectDialogInstant();
      finishDiscardPileSelection(selectedDiscardPileId);
    } : null, !selectedDiscardPileId);
    return;
  }
  if (defeatSelection?.actorIndex === 0) {
    const selectedTargetId = defeatSelection.cardIds.has(inspectedLocalBoardCardId)
      ? inspectedLocalBoardCardId
      : "";
    appendHandActionButton(els.localHandActions, "Chọn", "primary", selectedTargetId ? async () => {
      await closeInspectDialogWithAnimation();
      finishDefeatSelection(selectedTargetId);
    } : null, !selectedTargetId);
    return;
  }
  if (stealSelection?.actorIndex === 0) {
    const selectedTargetId = stealSelection.cardIds.has(inspectedLocalBoardCardId)
      ? inspectedLocalBoardCardId
      : "";
    appendHandActionButton(els.localHandActions, "Chọn", "primary", selectedTargetId ? async () => {
      await closeInspectDialogWithAnimation();
      finishStealSelection(selectedTargetId);
    } : null, !selectedTargetId);
    if (stealSelection.allowSkip) {
      appendHandActionButton(els.localHandActions, "Không", "secondary", async () => {
        await closeInspectDialogWithAnimation();
        cancelStealSelection();
      });
    }
    return;
  }
  if (utilityKeywordSelection?.actorIndex === 0) {
    const selectedTargetId = utilityKeywordSelection.cardIds.has(inspectedLocalBoardCardId)
      ? inspectedLocalBoardCardId
      : "";
    appendHandActionButton(els.localHandActions, "Chọn", "primary", selectedTargetId ? async () => {
      await closeInspectDialogWithAnimation();
      if (duelModeActive) sendDuelAction({ type: "utility-play-choice", cardId: selectedTargetId });
      else finishUtilityPlaySelection(selectedTargetId);
    } : null, !selectedTargetId);
    return;
  }
  const inspectedCard = local.hand.find(card => card.id === inspectedLocalHandCardId);
  if (inspectedCard && state.active === 0 && state.phase === "action" && !state.frenzyOnly && !hasWinner()) {
    appendHandActionButton(els.localHandActions, "Chơi", "primary", async () => {
      await closeInspectDialogWithFade();
      if (duelModeActive) {
        sendDuelAction({ type: "play-card", cardId: inspectedCard.id });
        return;
      }
      await playCard(inspectedCard.id);
      broadcastDuelState("play-card");
    });
    return;
  }
  const inspectedBoardCard = local.board.find(card => card.id === inspectedLocalBoardCardId);
  const canUseBoardAction = inspectedBoardCard
    && state.phase === "action"
    && !hasWinner()
    && (state.active === 0 || (!duelModeActive && animationTestMode));
  if (canUseBoardAction) {
    const attackReady = canAttack(inspectedBoardCard, 0);
    appendHandActionButton(els.localHandActions, "Tấn công", "primary", attackReady ? async () => {
      await closeInspectDialogWithAnimation();
      if (duelModeActive) {
        sendDuelAction({ type: "attack", cardId: inspectedBoardCard.id });
        return;
      }
      await attack(inspectedBoardCard.id);
      broadcastDuelState("attack");
    } : null, !attackReady);
    if (ACTION_ABILITY_CARDS.has(inspectedBoardCard.name)) {
      const actionReady = canUseEvolutionAction(inspectedBoardCard, 0);
      appendHandActionButton(els.localHandActions, "Tưới", "primary", actionReady ? async () => {
        await closeInspectDialogWithAnimation();
        if (duelModeActive) {
          sendDuelAction({ type: "action-card", cardId: inspectedBoardCard.id });
          return;
        }
        await useEvolutionAction(inspectedBoardCard.id, 0);
      } : null, !actionReady);
    }
    return;
  }
  if (state.extraTurn && state.extraTurnSource !== "mindbug" && state.active === 0 && !hasWinner()) {
    appendHandActionButton(els.localHandActions, "Không", "secondary", () => {
      if (duelModeActive) {
        sendDuelAction({ type: "end-turn" });
        return;
      }
      endTurn();
      broadcastDuelState("end-turn");
    });
    appendMindbugInfo(els.localHandActions, local.mindbugs);
    return;
  }
  appendMindbugInfo(els.localHandActions, local.mindbugs);
}

function appendMindbugInfo(container, count) {
  const info = document.createElement("div");
  info.className = "handActionMindbugInfo";
  info.innerHTML = mindbugInfoHtml(count);
  container.append(info);
}

function appendHandActionButton(container, label, variant = "primary", onClick = null, disabled = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `handActionButton ${variant === "secondary" ? "secondary" : ""}`;
  button.textContent = label;
  button.disabled = disabled;
  if (onClick) button.addEventListener("click", onClick);
  container.append(button);
}

function setHandFanVars(element, index, count, container = null) {
  const offset = index - (count - 1) / 2;
  const arc = Math.abs(offset);
  const cardWidth = element.classList.contains("cardBack") ? 59 : 79;
  const containerWidth = container?.clientWidth || 292;
  const safetyMargin = count > 5 ? 8 : 10;
  const availableFanWidth = Math.max(0, containerWidth - cardWidth - safetyMargin);
  const isCardBack = element.classList.contains("cardBack");
  const maxFanStep = isCardBack
    ? (count > 8 ? 24 : count > 6 ? 30 : count > 4 ? 48 : 54)
    : (count > 8 ? 24 : count > 6 ? 30 : count > 4 ? 48 : 54);
  const fanStep = count > 1 ? Math.min(maxFanStep, availableFanWidth / (count - 1)) : 0;
  const fanX = (offset * fanStep).toFixed(1);
  const bottomY = (arc * (count > 6 ? 2 : 2.6)).toFixed(1);
  const topY = (arc * (count > 6 ? -2 : -2.6)).toFixed(1);
  const rotateStep = count > 8 ? 2.7 : count > 6 ? 3.2 : 4;
  const bottomRotate = (offset * rotateStep).toFixed(1);
  const topRotate = (offset * -rotateStep).toFixed(1);
  const bottomTransform = `translateX(calc(-50% + ${fanX}px)) translateY(calc(22px + ${bottomY}px)) rotate(${bottomRotate}deg)`;
  const topTransform = `translateX(calc(-50% + ${fanX}px)) translateY(${topY}px) rotate(${topRotate}deg)`;
  element.style.setProperty("--card-index", index);
  element.style.setProperty("--fan-offset", offset.toFixed(2));
  element.style.setProperty("--fan-x", `${fanX}px`);
  element.style.setProperty("--fan-y-bottom", `${bottomY}px`);
  element.style.setProperty("--fan-y-top", `${topY}px`);
  element.style.setProperty("--fan-rotate-bottom", `${bottomRotate}deg`);
  element.style.setProperty("--fan-rotate-top", `${topRotate}deg`);
  element.style.setProperty("--hand-card-transform", bottomTransform);
  element.style.setProperty("--hand-card-press-transform", `translateX(calc(-50% + ${fanX}px + 2px)) translateY(calc(24px + ${bottomY}px)) rotate(${bottomRotate}deg)`);
  element.style.setProperty("--opponent-card-transform", topTransform);
  element.style.zIndex = String(element.classList.contains("cardBack") ? 20 + (count - index) : 20 + index);
}

function handLayoutSnapshot(key) {
  return new Map(handLayoutCache.get(key) ?? []);
}

function clearHandLayout(key) {
  handLayoutVersions.set(key, (handLayoutVersions.get(key) ?? 0) + 1);
  handLayoutCache.set(key, new Map());
}

function animateHandLayout(container, previousLayout, selector, side = "bottom", cacheKey = "") {
  const cards = [...container.querySelectorAll(selector)];
  const layoutVersion = (handLayoutVersions.get(cacheKey) ?? 0) + 1;
  if (cacheKey) handLayoutVersions.set(cacheKey, layoutVersion);
  if (!cards.length) {
    if (cacheKey) handLayoutCache.set(cacheKey, new Map());
    return;
  }
  const newCardOrders = new Map();
  let newCardCount = 0;
  for (const cardEl of cards) {
    if (!previousLayout.has(cardEl.dataset.cardId)) {
      newCardOrders.set(cardEl.dataset.cardId, newCardCount);
      newCardCount += 1;
    }
  }
  window.requestAnimationFrame(() => {
    if (cacheKey && handLayoutVersions.get(cacheKey) !== layoutVersion) return;
    if (!cards.some(cardEl => cardEl.isConnected)) return;
    const currentLayout = new Map();
    const animationPlans = [];
    for (const cardEl of cards) {
      const baseTransform = side === "top"
        ? cardEl.style.getPropertyValue("--opponent-card-transform")
        : cardEl.style.getPropertyValue("--hand-card-transform");
      const currentRect = cardEl.getBoundingClientRect();
      currentLayout.set(cardEl.dataset.cardId, currentRect);
      const previousRect = previousLayout.get(cardEl.dataset.cardId);
      const newCardOrder = newCardOrders.get(cardEl.dataset.cardId);
      const isNewCard = newCardOrder !== undefined;
      animationPlans.push({ cardEl, baseTransform, currentRect, previousRect, newCardOrder, isNewCard });
    }
    for (const plan of animationPlans) {
      const { cardEl, baseTransform, currentRect, previousRect, newCardOrder, isNewCard } = plan;
      const deltaX = previousRect ? previousRect.left - currentRect.left : 0;
      const deltaY = previousRect ? previousRect.top - currentRect.top : 0;
      if (previousRect && Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) continue;
      const appRect = document.querySelector(".app")?.getBoundingClientRect();
      const offscreenRight = (appRect?.right ?? window.innerWidth) + currentRect.width + 18;
      const offscreenLeft = (appRect?.left ?? 0) - currentRect.width - 18;
      const newCardEnterX = side === "bottom" ? offscreenRight - currentRect.left : 0;
      const newOpponentCardEnterX = side === "top" ? offscreenLeft - currentRect.left : 0;
      const fromTransform = previousRect
        ? `translate3d(${deltaX}px, ${deltaY}px, 0) ${baseTransform}`
        : side === "bottom"
          ? `translate3d(${newCardEnterX}px, 0, 0) scale(.92) ${baseTransform}`
          : `translate3d(${newOpponentCardEnterX}px, 0, 0) scale(.92) ${baseTransform}`;
      const index = Number.parseInt(cardEl.style.getPropertyValue("--card-index") || "0", 10);
      const layerOffset = Math.abs(index - (cards.length - 1) / 2);
      const delay = isNewCard
        ? newCardOrder * 72
        : newCardCount > 1
          ? Math.round((index * 17) + (layerOffset * 9))
          : Math.round(layerOffset * 12);
      const settleDirection = side === "top" ? -1 : 1;
      const keyframes = previousRect
        ? [
          { opacity: 1, transform: fromTransform, offset: 0 },
          {
            opacity: 1,
            transform: `translate3d(${-deltaX * 0.24}px, ${(-deltaY * 0.24) + (settleDirection * 5)}px, 0) scale(1.04) ${baseTransform}`,
            offset: 0.72
          },
          {
            opacity: 1,
            transform: `translate3d(${deltaX * 0.08}px, ${(deltaY * 0.08) - (settleDirection * 2)}px, 0) scale(.982) ${baseTransform}`,
            offset: 0.9
          },
          { opacity: 1, transform: baseTransform, offset: 1 }
        ]
        : [
          { opacity: 0, transform: fromTransform, offset: 0 },
          {
            opacity: 1,
            transform: side === "bottom"
              ? `translate3d(-10px, ${settleDirection * -4}px, 0) scale(1.07) ${baseTransform}`
              : `translate3d(10px, ${settleDirection * -4}px, 0) scale(1.07) ${baseTransform}`,
            offset: 0.72
          },
          {
            opacity: 1,
            transform: side === "bottom"
              ? `translate3d(4px, ${settleDirection * 2}px, 0) scale(.976) ${baseTransform}`
              : `translate3d(-4px, ${settleDirection * 2}px, 0) scale(.976) ${baseTransform}`,
            offset: 0.9
          },
          { opacity: 1, transform: baseTransform, offset: 1 }
        ];
      setCardAnimationState(CARD_ANIMATION_STATE.HAND_REFLOW, cardEl.dataset.cardId, { side });
      const animation = cardEl.animate(keyframes, {
        delay: motionMs(delay),
        duration: motionMs(previousRect
          ? 315 + ((index % 3) * 34)
          : 360 + ((newCardOrder % 3) * 42)),
        easing: "cubic-bezier(.2, .8, .2, 1)",
        fill: "both"
      });
      animation.finished.then(
        () => clearCardAnimationState(CARD_ANIMATION_STATE.HAND_REFLOW, cardEl.dataset.cardId),
        () => clearCardAnimationState(CARD_ANIMATION_STATE.HAND_REFLOW, cardEl.dataset.cardId)
      );
    }
    if (cacheKey) handLayoutCache.set(cacheKey, currentLayout);
  });
}

function animateBoardLayout(container, previousLayout, cacheKey) {
  const slots = [...container.querySelectorAll(".fieldCardSlot")];
  const layoutVersion = (handLayoutVersions.get(cacheKey) ?? 0) + 1;
  handLayoutVersions.set(cacheKey, layoutVersion);
  if (!slots.length) {
    handLayoutCache.set(cacheKey, new Map());
    return;
  }
  const newSlots = slots.filter(slot => !previousLayout.has(slot.dataset.cardId));
  const enterSlots = newSlots.filter(slot => !suppressedBoardEnterCardIds.has(slot.dataset.cardId));
  for (const slot of enterSlots) {
    slot.style.opacity = "0";
  }
  window.requestAnimationFrame(() => {
    if (handLayoutVersions.get(cacheKey) !== layoutVersion) return;
    if (!slots.some(slot => slot.isConnected)) return;
    const currentLayout = new Map();
    let maxMoveEnd = 0;
    for (const slot of slots) {
      const currentRect = slot.getBoundingClientRect();
      currentLayout.set(slot.dataset.cardId, currentRect);
      const previousRect = previousLayout.get(slot.dataset.cardId);
      if (!previousRect) continue;
      const deltaX = previousRect.left - currentRect.left;
      const deltaY = previousRect.top - currentRect.top;
      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) continue;
      const index = slots.indexOf(slot);
      const delay = Math.round(index * 34);
      const duration = 520 + ((index % 3) * 46);
      maxMoveEnd = Math.max(maxMoveEnd, delay + duration);
      slot.animate([
        { opacity: 1, transform: `translate3d(${deltaX}px, ${deltaY}px, 0)`, offset: 0 },
        { opacity: 1, transform: `translate3d(${-deltaX * 0.1}px, ${-deltaY * 0.1}px, 0) scale(1.012)`, offset: 0.76 },
        { opacity: 1, transform: `translate3d(${deltaX * 0.025}px, ${deltaY * 0.025}px, 0) scale(.996)`, offset: 0.92 },
        { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)", offset: 1 }
      ], {
        delay: motionMs(delay),
        duration: motionMs(duration),
        easing: "cubic-bezier(.2, .8, .2, 1)",
        fill: "both"
      });
    }
    const newCardDelay = maxMoveEnd ? Math.round(maxMoveEnd * 0.5) : 80;
    enterSlots.forEach((slot, order) => {
      if (!slot.isConnected) return;
      const animation = slot.animate([
        { opacity: 0, transform: "translate3d(0, 8px, 0) scale(.5)", offset: 0 },
        { opacity: 1, transform: "translate3d(0, -3px, 0) scale(1.08)", offset: 0.74 },
        { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)", offset: 1 }
      ], {
        delay: motionMs(newCardDelay + (order * 40)),
        duration: motionMs(320),
        easing: "cubic-bezier(.2, .8, .2, 1)",
        fill: "both"
      });
      animation.finished.then(
        () => { if (slot.isConnected) slot.style.opacity = ""; },
        () => { if (slot.isConnected) slot.style.opacity = ""; }
      );
    });
    handLayoutCache.set(cacheKey, currentLayout);
  });
}

function boardCardScale(count, rowElement = null) {
  if (count <= 0) return 0.245;
  const rowWidth = rowElement?.clientWidth || 342;
  const rowHeight = rowElement?.clientHeight || CARD_BASE_HEIGHT;
  const gap = 3;
  const cardsPerRow = Math.min(Math.max(count, BOARD_ROW_CAPACITY), BOARD_ROW_CAPACITY);
  const rowCount = Math.max(1, Math.ceil(count / BOARD_ROW_CAPACITY));
  const widthScale = (rowWidth - Math.max(0, cardsPerRow - 1) * gap) / (cardsPerRow * CARD_BASE_WIDTH);
  const heightScale = (rowHeight - Math.max(0, rowCount - 1) * gap) / (rowCount * CARD_BASE_HEIGHT);
  const scale = Math.min(widthScale, heightScale);
  return Math.max(0.04, Math.min(0.72, scale)).toFixed(3);
}

function renderHand() {
  const handOwnerIndex = 0;
  const player = state.players[handOwnerIndex];
  const visibleHand = player.hand.filter(card => !hiddenReceivedHandCardIds.has(card.id));
  const previousLayout = handLayoutSnapshot("local");
  els.hand.innerHTML = "";
  if (discardSelection?.ownerIndex === handOwnerIndex) {
    if (!visibleHand.length) {
      clearHandLayout("local");
      return;
    }
    for (const card of visibleHand) {
      const cardEl = renderCard(card, handOwnerIndex, "hand");
      setHandFanVars(cardEl, els.hand.children.length, visibleHand.length, els.hand);
      els.hand.append(cardEl);
    }
    animateHandLayout(els.hand, previousLayout, ".hand > .card", "bottom", "local");
    return;
  }
  if (!visibleHand.length) {
    clearHandLayout("local");
    return;
  }
  for (const card of visibleHand) {
    const cardEl = renderCard(card, handOwnerIndex, "hand");
    setHandFanVars(cardEl, els.hand.children.length, visibleHand.length, els.hand);
    els.hand.append(cardEl);
  }
  animateHandLayout(els.hand, previousLayout, ".hand > .card", "bottom", "local");
}

function renderCard(card, ownerIndex, zone) {
  const cardEl = document.createElement("article");
  const power = cardPower(card, ownerIndex);
  const keywords = cardKeywords(card, ownerIndex);
  const captainForcedAttackers = zone === "board" && state.phase === "action" && ownerIndex === state.active
    ? captainHippoForcedAttackers(ownerIndex)
    : [];
  const isCaptainForcedAttacker = captainForcedAttackers.some(attacker => attacker.id === card.id);
  const isCaptainForcedUnavailable = captainForcedAttackers.length > 0 && !isCaptainForcedAttacker;
  const serverBlockCandidate = isDuelBlockCandidate(card, ownerIndex, zone);
  const isBlockCandidate = serverBlockCandidate || Boolean(blockSelection?.cardIds.has(card.id) && ownerIndex === blockSelection.ownerIndex && zone === "board");
  const isDiscardCandidate = Boolean(discardSelection?.cardIds.has(card.id) && ownerIndex === discardSelection.ownerIndex && zone === "hand");
  const isDefeatCandidate = Boolean(
    (defeatSelection?.cardIds.has(card.id) && (defeatSelection.ownerIndex === null || ownerIndex === defeatSelection.ownerIndex) && zone === "board")
    || (disableBlockSelection?.cardIds.has(card.id) && ownerIndex === disableBlockSelection.ownerIndex && zone === "board")
  );
  const isStealCandidate = Boolean(stealSelection?.cardIds.has(card.id) && ownerIndex === stealSelection.ownerIndex && zone === "board");
  const isHunterTargetCandidate = Boolean(hunterTargetSelection?.cardIds.has(card.id) && ownerIndex === hunterTargetSelection.ownerIndex && zone === "board");
  const isUtilityKeywordCandidate = Boolean(utilityKeywordSelection?.cardIds.has(card.id) && zone === "board");
  const isReceivedCardCandidate = Boolean(duelModeActive && state.pending?.type === "received-card" && state.pending.cardId === card.id && ownerIndex === state.pending.playerIndex && zone === "hand");
  const isDamaged = zone === "board" && isCardAnimationState(card.id, CARD_ANIMATION_STATE.DAMAGED);
  const isBoardExiting = zone === "board" && isCardAnimationState(card.id, CARD_ANIMATION_STATE.BOARD_EXIT);
  const isDuelMindbugPending = duelModeActive && state.pending?.type === "mindbug" && state.pending.cardId === card.id;
  const isMindbugPending = zone === "board" && (isCardAnimationState(card.id, CARD_ANIMATION_STATE.MINDBUG_PENDING) || isDuelMindbugPending);
  const isDimmed = zone === "board" && activeDimmedCardIds.has(card.id);
  const isDimEntering = zone === "board" && enteringDimmedCardIds.has(card.id);
  const isDimFading = zone === "board" && fadingDimmedCardIds.has(card.id);
  const isMindbugTravelHidden = zone === "board" && hiddenMindbugTravelCardIds.has(card.id);
  const isBoardExitHidden = zone === "board" && hiddenBoardExitCardIds.has(card.id);
  const isEvolutionHidden = zone === "board" && hiddenEvolutionCardIds.has(card.id);
  const isDuelPendingSource = duelPendingSourceCardId() === card.id;
  const isEffectSourcePending = zone === "board" && (
    discardSelection?.sourceCard?.id === card.id
    || discardPileSelection?.sourceCard?.id === card.id
    || defeatSelection?.sourceCard?.id === card.id
    || disableBlockSelection?.sourceCard?.id === card.id
    || stealSelection?.sourceCard?.id === card.id
    || hunterTargetSelection?.attacker?.id === card.id
    || drOrangeChoicePrompt?.cardId === card.id
    || earwigChoicePrompt?.cardId === card.id
    || utilityKeywordSelection?.sourceCard?.id === card.id
    || isDuelPendingSource
  );
  const isSelected = (zone === "hand" && ownerIndex === 0 && inspectedLocalHandCardId === card.id)
    || (zone === "board" && inspectedLocalBoardCardId === card.id);
  const canAct = inspectCardCanAct(card, ownerIndex, zone);
  cardEl.className = `card ${canAct && !hasWinner() ? "canAct" : ""} ${isSelected ? "selectedCard" : ""} ${isEffectSourcePending ? "effectSourcePendingCard" : ""} ${isBlockCandidate ? "blockCandidate" : ""} ${isDiscardCandidate ? "discardCandidate" : ""} ${isDefeatCandidate ? "defeatCandidate" : ""} ${isStealCandidate ? "stealCandidate" : ""} ${isHunterTargetCandidate ? "hunterTargetCandidate" : ""} ${isUtilityKeywordCandidate ? "utilityKeywordCandidate" : ""} ${isCaptainForcedAttacker ? "captainForcedAttacker" : ""} ${isCaptainForcedUnavailable ? "captainForcedUnavailable" : ""} ${isReceivedCardCandidate ? "receivedCardCandidate" : ""} ${isDamaged ? "cardHitShake" : ""} ${isBoardExiting ? "boardCardExit" : ""} ${isMindbugPending ? "mindbugPendingCard" : ""} ${isDimmed ? "dimmedCard" : ""} ${isDimEntering ? "dimmedCardFadeIn" : ""} ${isDimFading ? "dimmedCardFadeOut" : ""} ${isMindbugTravelHidden ? "mindbugTravelHidden" : ""} ${isBoardExitHidden ? "boardExitHidden" : ""} ${isEvolutionHidden ? "evolutionHidden" : ""}`;
  cardEl.dataset.cardId = card.id;
  applyCardSprite(cardEl, card);
  cardEl.innerHTML = cardFaceHtml(card, power, keywords, zone, ownerIndex);
  cardEl.addEventListener("click", () => {
    if (isHunterTargetCandidate) {
      if (duelModeActive && state.pending?.type === "hunter") {
        inspectCard(card, ownerIndex, zone, cardEl);
        return;
      }
      finishHunterTargetSelection(card.id);
      return;
    }
    inspectCard(card, ownerIndex, zone, cardEl);
  });
  return cardEl;
}

function inspectCardCanAct(card, ownerIndex, zone) {
  if (hasWinner()) return false;
  if (discardSelection && zone === "board") return false;
  const isServerBlockCandidate = isDuelBlockCandidate(card, ownerIndex, zone);
  const isBlockCandidate = Boolean(blockSelection?.cardIds.has(card.id) && ownerIndex === blockSelection.ownerIndex && zone === "board");
  const isDiscardCandidate = Boolean(discardSelection?.cardIds.has(card.id) && ownerIndex === discardSelection.ownerIndex && zone === "hand");
  const isDefeatCandidate = Boolean(
    (defeatSelection?.cardIds.has(card.id) && (defeatSelection.ownerIndex === null || ownerIndex === defeatSelection.ownerIndex) && zone === "board")
    || (disableBlockSelection?.cardIds.has(card.id) && ownerIndex === disableBlockSelection.ownerIndex && zone === "board")
  );
  const isStealCandidate = Boolean(stealSelection?.cardIds.has(card.id) && ownerIndex === stealSelection.ownerIndex && zone === "board");
  const isHunterTargetCandidate = Boolean(hunterTargetSelection?.cardIds.has(card.id) && ownerIndex === hunterTargetSelection.ownerIndex && zone === "board");
  const isUtilityKeywordCandidate = Boolean(utilityKeywordSelection?.cardIds.has(card.id) && zone === "board");
  const isDiscardPileCandidate = Boolean(discardPileSelection?.cardIds.has(card.id) && ownerIndex === discardPileSelection.ownerIndex && zone === "discard");
  const isReceivedCardCandidate = Boolean(duelModeActive && state.pending?.type === "received-card" && state.pending.cardId === card.id && ownerIndex === state.pending.playerIndex && zone === "hand");
  const isNormalAction = state.phase === "action" && ownerIndex === state.active;
  const isLocalNormalAction = isNormalAction && ownerIndex === 0 && !captainHippoForcedAttackers(ownerIndex).length;
  const isAnimationTestBoardAction = !duelModeActive && animationTestMode && state.phase === "action" && zone === "board" && canAttack(card, ownerIndex);
  const isEvolutionAction = zone === "board" && ownerIndex === 0 && canUseEvolutionAction(card, ownerIndex);
  return (zone === "hand" && isLocalNormalAction)
    || isServerBlockCandidate
    || isBlockCandidate
    || isDiscardCandidate
    || isDiscardPileCandidate
    || isDefeatCandidate
    || isStealCandidate
    || isHunterTargetCandidate
    || isUtilityKeywordCandidate
    || isReceivedCardCandidate
    || isAnimationTestBoardAction
    || isEvolutionAction
    || (isLocalNormalAction && zone === "board" && canAttack(card, ownerIndex));
}

function renderAttackIntentClone(card, ownerIndex) {
  const clone = document.createElement("article");
  clone.className = `card attackIntentClone animationCard ${ownerIndex === 0 ? "attackIntentCloneUp" : "attackIntentCloneDown"}`;
  clone.dataset.cardId = card.id;
  clone.setAttribute("aria-label", displayCardName(card));
  applyCardSprite(clone, card);
  clone.innerHTML = cardFaceHtml(card, cardPower(card, ownerIndex), cardKeywords(card, ownerIndex), "board", ownerIndex);
  return clone;
}

function clearAttackIntentLayer() {
  document.querySelector(".cardTopLayer.attackIntentLayer")?.remove();
}

function renderAttackIntentLayer(card, ownerIndex) {
  const source = els.arena.querySelector(`.fieldCards [data-card-id="${card.id}"]`);
  if (!source) return;
  const app = document.querySelector(".app");
  if (!app) return;
  clearAttackIntentLayer();
  const layer = document.createElement("div");
  layer.className = "cardTopLayer attackIntentLayer";
  app.append(layer);
  const layerRect = layer.getBoundingClientRect();
  const sourceRect = rectToLocal(source.getBoundingClientRect(), layerRect);
  const clone = renderAttackIntentClone(card, ownerIndex);
  const isEntering = cardAnimationStates.get(card.id)?.data?.transition === "entering";
  const intentScale = sourceRect.width / CARD_BASE_WIDTH;
  clone.style.setProperty("--intent-scale", intentScale.toFixed(4));
  clone.style.left = `${sourceRect.left - ((CARD_BASE_WIDTH - sourceRect.width) / 2)}px`;
  clone.style.top = `${sourceRect.top - ((CARD_BASE_HEIGHT - sourceRect.height) / 2)}px`;
  clone.style.width = `${CARD_BASE_WIDTH}px`;
  clone.style.height = `${CARD_BASE_HEIGHT}px`;
  clone.style.minWidth = `${CARD_BASE_WIDTH}px`;
  clone.style.minHeight = `${CARD_BASE_HEIGHT}px`;
  if (isEntering) clone.style.transform = `translateY(0) scale(${intentScale.toFixed(4)})`;
  clone.addEventListener("click", event => {
    event.stopPropagation();
    inspectCard(card, ownerIndex, "board", clone);
  });
  layer.append(clone);
}

function cardFaceHtml(card, power, keywords, zone, ownerIndex = null, isOverlay = false) {
  const supportNote = abilitySupportNote(card);
  const effectTags = Number.isInteger(ownerIndex) ? cardEffectTags(card, ownerIndex, zone) : { powerBonus: 0, keywords: [] };
  const basePower = Number.isFinite(card.basePower) ? card.basePower : power;
  const showBaseKeywordTags = Number.isInteger(ownerIndex) && (zone === "board" || isOverlay);
  const shieldIsBroken = Number.isInteger(ownerIndex) && hasBrokenShield(card, ownerIndex);
  const abilityBlocked = Number.isInteger(ownerIndex) && isOverlay && zone === "board" && isPlayAbilityBlocked(card, ownerIndex);
  const baseKeywordTags = showBaseKeywordTags
    ? card.keywords
      .filter(keyword => !(keyword === "TOUGH" && shieldIsBroken))
      .map(keyword => `<span class="effectTag effectTagKeyword effectTagBaseKeyword keyword${keyword}">${displayKeyword(keyword)}</span>`)
    : [];
  const brokenShieldTag = shieldIsBroken && zone !== "discard"
    ? `<span class="effectTag effectTagKeyword effectTagBrokenShield keywordTOUGH">KHIÊN</span>`
    : "";
  const keywordTags = [
    ...baseKeywordTags,
    ...effectTags.keywords.map(tag => `<span class="effectTag effectTagKeyword keyword${tag.key}">${tag.label}</span>`),
    brokenShieldTag
  ].filter(Boolean).join("");
  const boardPowerTags = zone === "board"
    ? `<div class="effectTags effectTagsBoardPower"><span class="effectTag effectTagBasePower">${basePower}</span></div>${effectTags.powerBonus > 0 ? `<div class="effectTags effectTagsBoardPowerBonus"><span class="effectTag effectTagPower">+${effectTags.powerBonus}</span></div>` : ""}`
    : "";
  return `
    ${boardPowerTags}
    ${zone !== "board" && effectTags.powerBonus > 0 ? `<div class="effectTags effectTagsPower"><span class="effectTag effectTagPower">+${effectTags.powerBonus}</span></div>` : ""}
    ${keywordTags ? `<div class="effectTags effectTagsKeyword">${keywordTags}</div>` : ""}
    ${abilityBlocked ? `<div class="abilityBlockedMark" aria-hidden="true"></div>` : ""}
    <div class="cardTopline">
      <div class="powerBadge">${power}</div>
      <div class="cardName">${displayCardName(card)}</div>
    </div>
    <div class="keywords">${keywords.length ? keywords.map(k => `<span class="tag keyword${k}">${displayKeyword(k)}</span>`).join("") : `<span class="tag">KHÔNG</span>`}</div>
    <p class="ability">${displayAbilityHtml(card)}</p>
    ${supportNote ? `<p class="abilityWarning">Cần rà ability: ${supportNote}</p>` : ""}
    ${zone === "board" ? `<p class="muted">Sát thương Khiên: ${card.damage}</p>` : ""}
  `;
}

function displayKeyword(keyword) {
  return KEYWORD_LABELS[keyword] ?? keyword;
}

function displayCardName(card) {
  return CARD_NAME_LABELS[card.name] ?? card.name;
}

function displayAbility(card) {
  return ABILITY_LABELS[card.name] ?? card.ability;
}

function hasDisplayableAbilityText(text) {
  return String(text || "").trim().toLowerCase() !== "không có hiệu ứng.";
}

function displayAbilityHtml(card) {
  return formatAbilityHtml(displayAbility(card));
}

function formatAbilityHtml(text) {
  const raw = String(text || "");
  const withoutConstant = raw.replace(/^Liên tục:\s*/i, "");
  const match = withoutConstant.match(/^(Khi vào sân|Khi tấn công|Khi chết|Khi ở dưới Mộ bài|Khi ở Mộ bài|Khi Được tưới|Tưới)[:,]\s*(.*)$/i);
  if (!match) return escapeHtml(withoutConstant);
  const trigger = match[1];
  const body = match[2] ?? "";
  return `<span class="abilityTrigger">${escapeHtml(trigger)}:</span><span class="abilityText">${escapeHtml(body)}</span>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function applyCardSprite(cardEl, card) {
  const spriteUrl = cardSpriteUrl(card);
  if (spriteUrl) cardEl.style.setProperty("--card-front-image", spriteUrl);
}

function cardSpriteUrl(card) {
  const src = cardSpriteSrc(card.name);
  return src ? `url('${src}')` : "";
}

function cardSpriteSrc(cardName) {
  const fileName = CARD_SPRITE_FILES[cardName];
  if (!fileName) return "";
  return new URL(`assets/cards/${encodeURIComponent(fileName)}`, APP_ROOT_URL).href;
}

function allGameAssetUrls() {
  return [...new Set([
    ...STATIC_PRELOAD_ASSETS,
    ...WATERDROP_FX_FRAMES,
    ...Object.keys(CARD_SPRITE_FILES).map(cardSpriteSrc).filter(Boolean),
    ...Array.from({ length: 16 }, (_, index) => avatarUrl(index + 1))
  ])];
}

function preloadImage(url) {
  if (retainedPreloadedImages.has(url)) return Promise.resolve();
  return new Promise(resolve => {
    const image = new Image();
    // Keep decoded sprites alive for the whole session. Mobile Safari can
    // otherwise discard the temporary preload Image and briefly paint a blank
    // CSS background whenever the board DOM is rebuilt.
    image.decoding = "sync";
    image.loading = "eager";
    retainedPreloadedImages.set(url, image);
    image.onload = () => {
      if (typeof image.decode === "function") {
        image.decode().catch(() => {}).finally(resolve);
      } else {
        resolve();
      }
    };
    image.onerror = () => {
      retainedPreloadedImages.delete(url);
      resolve();
    };
    image.src = url;
  });
}

async function preloadGameFonts() {
  if (!document.fonts?.load) return;
  await Promise.allSettled([
    document.fonts.load("16px DearPix"),
    document.fonts.load("32px DearPix")
  ]);
}

function setLobbyAssetLoading(isLoading, loaded = 0, total = 1) {
  for (const button of [els.lobbyStartButton, els.lobbyModeSolo, els.lobbyModeDuel, els.lobbyCreateRoomButton, els.lobbyJoinRoomButton]) {
    if (button) button.disabled = isLoading;
  }
  const progress = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 100;
  if (els.lobbyPreloadOverlay) els.lobbyPreloadOverlay.hidden = !isLoading;
  if (els.lobbyPreloadFill) els.lobbyPreloadFill.style.width = `${progress}%`;
  if (els.lobbyPreloadPercent) els.lobbyPreloadPercent.textContent = `${progress}%`;
  if (els.lobbyPreloadBar) els.lobbyPreloadBar.setAttribute("aria-valuenow", String(progress));
}

async function ensureGameAssetsPreloaded({ showLobbyStatus = false } = {}) {
  if (gameAssetsPreloaded) return;
  if (!gameAssetsPreloadPromise) {
    gameAssetsPreloadPromise = (async () => {
      const assets = allGameAssetUrls();
      const total = assets.length + 1;
      let loaded = 0;
      const startedAt = performance.now();
      const updateProgress = () => {
        if (isLobbyVisible()) setLobbyAssetLoading(true, loaded, total);
      };
      updateProgress();
      await preloadGameFonts();
      loaded += 1;
      updateProgress();
      await Promise.allSettled(assets.map(async url => {
        await preloadImage(url);
        loaded += 1;
        updateProgress();
      }));
      const remainingMs = 550 - (performance.now() - startedAt);
      if (remainingMs > 0) {
        await new Promise(resolve => window.setTimeout(resolve, remainingMs));
      }
      await new Promise(resolve => window.setTimeout(resolve, 120));
      gameAssetsPreloaded = true;
      setLobbyAssetLoading(false, total, total);
    })();
  }
  if (showLobbyStatus && isLobbyVisible()) setLobbyAssetLoading(true);
  await gameAssetsPreloadPromise.catch(() => {});
  if (showLobbyStatus) {
    setLobbyAssetLoading(false, 1, 1);
    updateLobbyScreen();
  }
}

function abilitySupportNote(card) {
  if (!CREATURE_ABILITIES_ENABLED) return "Ability đang tắt.";
  return ABILITY_SUPPORT_NOTES[card.name] ?? "";
}

function positionCardInspectDialogAtBoard() {
  const boardRect = els.arena?.getBoundingClientRect();
  const appRect = document.querySelector(".app")?.getBoundingClientRect();
  const centerX = appRect ? appRect.left + appRect.width / 2 : window.innerWidth / 2;
  const centerY = boardRect ? boardRect.top + boardRect.height / 2 : window.innerHeight / 2;
  els.cardInspectDialog.style.left = `${centerX}px`;
  els.cardInspectDialog.style.top = `${centerY}px`;
}

function inspectCard(card, ownerIndex, zone, originEl = null) {
  if (inspectAnimation?.closing) return;
  document.querySelectorAll(".cardInspectGhost").forEach(cardEl => cardEl.classList.remove("cardInspectGhost"));
  inspectedLocalHandCardId = zone === "hand" && ownerIndex === 0 ? card.id : "";
  inspectedLocalBoardCardId = zone === "board" && (ownerIndex === 0 || defeatSelection?.cardIds.has(card.id) || disableBlockSelection?.cardIds.has(card.id) || stealSelection?.cardIds.has(card.id) || hunterTargetSelection?.cardIds.has(card.id) || utilityKeywordSelection?.cardIds.has(card.id)) ? card.id : "";
  inspectedDiscardPileCardId = zone === "discard" && discardPileSelection?.cardIds.has(card.id) ? card.id : "";
  renderLocalHandActions();
  const cardEl = document.createElement("article");
  const canAct = inspectCardCanAct(card, ownerIndex, zone);
  cardEl.className = `card inspectCard inspectCardPending ${canAct && !originEl ? "canAct" : ""}`;
  cardEl.dataset.canActWhenSettled = canAct ? "true" : "false";
  applyCardSprite(cardEl, card);
  cardEl.innerHTML = cardFaceHtml(card, cardPower(card, ownerIndex), cardKeywords(card, ownerIndex), zone, ownerIndex, true);
  const actions = document.createElement("div");
  actions.className = "cardActions";
  els.cardInspectContent.innerHTML = "";
  els.cardInspectContent.append(cardEl);
  if (actions.children.length) {
    actions.classList.add("cardActionsPending");
    els.cardInspectContent.append(actions);
    window.setTimeout(() => {
      if (actions.isConnected) actions.classList.remove("cardActionsPending");
    }, motionMs(260));
  }
  positionCardInspectDialogAtBoard();
  els.cardInspectDialog.show();
  document.activeElement?.blur?.();
  startInspectOpenAnimation(card.id, originEl, cardEl, zone, ownerIndex);
}

function showInspectCardImmediately(card, ownerIndex, zone, originEl = null) {
  if (inspectAnimation?.closing) return;
  document.querySelectorAll(".cardInspectGhost").forEach(cardEl => cardEl.classList.remove("cardInspectGhost"));
  inspectedLocalHandCardId = zone === "hand" && ownerIndex === 0 ? card.id : "";
  inspectedLocalBoardCardId = zone === "board" && (ownerIndex === 0 || defeatSelection?.cardIds.has(card.id) || disableBlockSelection?.cardIds.has(card.id) || stealSelection?.cardIds.has(card.id) || hunterTargetSelection?.cardIds.has(card.id) || utilityKeywordSelection?.cardIds.has(card.id)) ? card.id : "";
  inspectedDiscardPileCardId = zone === "discard" && discardPileSelection?.cardIds.has(card.id) ? card.id : "";
  renderLocalHandActions();
  const cardEl = document.createElement("article");
  cardEl.className = `card inspectCard ${inspectCardCanAct(card, ownerIndex, zone) ? "canAct" : ""}`;
  applyCardSprite(cardEl, card);
  cardEl.innerHTML = cardFaceHtml(card, cardPower(card, ownerIndex), cardKeywords(card, ownerIndex), zone, ownerIndex, true);
  els.cardInspectContent.innerHTML = "";
  els.cardInspectContent.append(cardEl);
  positionCardInspectDialogAtBoard();
  if (!els.cardInspectDialog.open) els.cardInspectDialog.show();
  inspectAnimation = {
    cardId: card.id,
    ownerIndex,
    originEl,
    originRect: normalizeCardTravelRect(originEl?.getBoundingClientRect()),
    targetEl: cardEl,
    zone,
    closing: false
  };
  clearCardAnimationState(CARD_ANIMATION_STATE.INSPECT_OPEN);
  clearCardAnimationState(CARD_ANIMATION_STATE.INSPECT_OPENING);
  setCardAnimationState(CARD_ANIMATION_STATE.INSPECT_OPEN, card.id, { zone });
  queueInspectHighlight(cardEl);
}

function queueInspectHighlight(cardEl) {
  cardEl?.classList.remove("inspectHighlightReady");
  window.setTimeout(() => {
    if (cardEl?.isConnected && cardEl.classList.contains("canAct") && !cardEl.classList.contains("inspectCardPending")) {
      cardEl.classList.add("inspectHighlightReady");
    }
  }, motionMs(70));
}

function startInspectOpenAnimation(cardId, originEl, targetEl, zone, ownerIndex = null) {
  const originRect = normalizeCardTravelRect(originEl?.getBoundingClientRect());
  const targetRect = normalizeCardTravelRect(targetEl.getBoundingClientRect());
  inspectAnimation = {
    cardId,
    ownerIndex,
    originEl,
    targetEl,
    originRect,
    zone,
    closing: false
  };
  const animationRef = inspectAnimation;
  setCardAnimationState(CARD_ANIMATION_STATE.INSPECT_OPENING, cardId, { zone });
  if (!originRect) {
    targetEl.classList.remove("inspectCardPending");
    if (targetEl.dataset.canActWhenSettled === "true") targetEl.classList.add("canAct");
    if (ownerIndex !== null && ownerIndex !== undefined) {
      const ownerCard = state.players[ownerIndex]?.[zone === "hand" ? "hand" : zone === "board" ? "board" : "discard"]?.find(card => card.id === cardId);
      if (ownerCard) targetEl.classList.toggle("canAct", inspectCardCanAct(ownerCard, ownerIndex, zone));
    }
    queueInspectHighlight(targetEl);
    setCardAnimationState(CARD_ANIMATION_STATE.INSPECT_OPEN, cardId, { zone });
    return;
  }
  if (zone === "hand") originEl.classList.add("cardInspectGhost");
  animateCardTravel(targetEl, originRect, targetRect, {
    className: zone === "discard" ? "discardInspectTravelClone" : "",
    tilt: cardTravelTilt(originEl),
    tiltMode: "open"
  }).then(clone => {
    window.requestAnimationFrame(() => {
      if (inspectAnimation !== animationRef || animationRef.closing) {
        clone.remove();
        return;
      }
      targetEl.classList.remove("inspectCardPending");
      if (ownerIndex !== null && ownerIndex !== undefined) {
        const ownerCard = state.players[ownerIndex]?.[zone === "hand" ? "hand" : zone === "board" ? "board" : "discard"]?.find(card => card.id === cardId);
        if (ownerCard) targetEl.classList.toggle("canAct", inspectCardCanAct(ownerCard, ownerIndex, zone));
      } else if (targetEl.dataset.canActWhenSettled === "true") {
        targetEl.classList.add("canAct");
      }
      queueInspectHighlight(targetEl);
      setCardAnimationState(CARD_ANIMATION_STATE.INSPECT_OPEN, cardId, { zone });
      window.requestAnimationFrame(() => {
        clone.remove();
      });
    });
  });
}

function cardTravelTilt(originEl) {
  const offset = Number.parseFloat(originEl?.style.getPropertyValue("--fan-offset") ?? "");
  if (Number.isNaN(offset)) return 0;
  return offset < 0 ? -3 : 3;
}

function normalizeCardTravelRect(rect) {
  if (!rect) return null;
  const width = rect.width;
  const height = rect.height;
  const currentAspect = width / height;
  let normalizedWidth = width;
  let normalizedHeight = height;
  if (currentAspect > CARD_ASPECT_RATIO) {
    normalizedWidth = height * CARD_ASPECT_RATIO;
  } else {
    normalizedHeight = width / CARD_ASPECT_RATIO;
  }
  const centerX = rect.left + width / 2;
  const centerY = rect.top + height / 2;
  return {
    left: centerX - normalizedWidth / 2,
    top: centerY - normalizedHeight / 2,
    width: normalizedWidth,
    height: normalizedHeight
  };
}

function animateCardTravel(sourceEl, fromRect, toRect, options = {}) {
  const clone = sourceEl.cloneNode(true);
  clone.classList.remove("inspectCardPending");
  clone.classList.remove("canAct");
  clone.classList.remove("inspectHighlightReady");
  clone.classList.add("cardTravelClone", "animationCard");
  clone.querySelectorAll(".effectTags").forEach(tagEl => tagEl.remove());
  clone.querySelectorAll(".abilityBlockedMark").forEach(markEl => markEl.remove());
  if (options.className) clone.classList.add(options.className);
  const overshoot = options.overshoot !== false;
  const fadeOutEarly = Boolean(options.fadeOutEarly);
  const tilt = options.tilt ?? 0;
  const tiltMode = options.tiltMode ?? "open";
  const startRotate = tiltMode === "close" ? 0 : tilt;
  const travelRotate = tilt;
  const endRotate = tiltMode === "close" ? tilt : 0;
  const travelX = toRect.left - fromRect.left;
  const travelY = toRect.top - fromRect.top;
  const scaleX = toRect.width / fromRect.width;
  const scaleY = toRect.height / fromRect.height;
  const overshootScale = 1.065;
  const settleScale = 0.985;
  const overshootX = travelX - (toRect.width * (overshootScale - 1)) / 2;
  const overshootY = travelY - (toRect.height * (overshootScale - 1)) / 2;
  const settleX = travelX - (toRect.width * (settleScale - 1)) / 2;
  const settleY = travelY - (toRect.height * (settleScale - 1)) / 2;
  clone.style.left = `${fromRect.left}px`;
  clone.style.top = `${fromRect.top}px`;
  clone.style.width = `${fromRect.width}px`;
  clone.style.height = `${fromRect.height}px`;
  clone.style.minWidth = `${fromRect.width}px`;
  clone.style.minHeight = `${fromRect.height}px`;
  clone.style.transform = `translate3d(0, 0, 0) scale(1, 1) rotate(${startRotate}deg)`;
  document.body.append(clone);
  const frames = overshoot
    ? [
      { opacity: 1, transform: `translate3d(0, 0, 0) scale(1, 1) rotate(${startRotate}deg)`, offset: 0 },
      {
        opacity: 1,
        transform: `translate3d(${travelX * 0.92}px, ${travelY * 0.92}px, 0) scale(${scaleX * 0.96}, ${scaleY * 0.96}) rotate(${travelRotate}deg)`,
        offset: 0.7
      },
      {
        opacity: 1,
        transform: `translate3d(${overshootX}px, ${overshootY}px, 0) scale(${scaleX * overshootScale}, ${scaleY * overshootScale}) rotate(${travelRotate * 0.5}deg)`,
        offset: 0.86
      },
      {
        opacity: 1,
        transform: `translate3d(${settleX}px, ${settleY}px, 0) scale(${scaleX * settleScale}, ${scaleY * settleScale}) rotate(${endRotate}deg)`,
        offset: 0.94
      },
      { opacity: 1, transform: `translate3d(${travelX}px, ${travelY}px, 0) scale(${scaleX}, ${scaleY}) rotate(${endRotate}deg)`, offset: 1 }
    ]
    : fadeOutEarly
      ? [
        { opacity: 1, transform: `translate3d(0, 0, 0) scale(1, 1) rotate(${startRotate}deg)`, offset: 0 },
        {
          opacity: 1,
          transform: `translate3d(${travelX * 0.68}px, ${travelY * 0.68}px, 0) scale(${scaleX * 0.98}, ${scaleY * 0.98}) rotate(${travelRotate}deg)`,
          offset: 0.68
        },
        {
          opacity: 0,
          transform: `translate3d(${travelX * 0.9}px, ${travelY * 0.9}px, 0) scale(${scaleX * 0.98}, ${scaleY * 0.98}) rotate(${endRotate}deg)`,
          offset: 0.86
        },
        { opacity: 0, transform: `translate3d(${travelX}px, ${travelY}px, 0) scale(${scaleX}, ${scaleY}) rotate(${endRotate}deg)`, offset: 1 }
      ]
      : [
        { opacity: 1, transform: `translate3d(0, 0, 0) scale(1, 1) rotate(${startRotate}deg)`, offset: 0 },
        {
          opacity: 1,
          transform: `translate3d(${travelX * 0.82}px, ${travelY * 0.82}px, 0) scale(${scaleX * 0.96}, ${scaleY * 0.96}) rotate(${travelRotate}deg)`,
          offset: 0.78
        },
        { opacity: 1, transform: `translate3d(${travelX}px, ${travelY}px, 0) scale(${scaleX}, ${scaleY}) rotate(${endRotate}deg)`, offset: 1 }
      ];
  const animation = clone.animate(frames, {
    duration: motionMs(options.duration ?? (overshoot ? 360 : 240)),
    easing: options.easing ?? "cubic-bezier(.2, .8, .2, 1)",
    fill: "forwards"
  });
  return animation.finished.then(() => clone, () => clone);
}

function playHandReturnBounce(cardEl) {
  if (!cardEl?.isConnected) return;
  const baseTransform = cardEl.style.getPropertyValue("--hand-card-transform");
  if (!baseTransform) return;
  cardEl.animate([
    { transform: baseTransform, offset: 0 },
    { transform: `translateY(9px) scale(1.035) ${baseTransform}`, offset: 0.42 },
    { transform: `translateY(-3px) scale(.99) ${baseTransform}`, offset: 0.72 },
    { transform: baseTransform, offset: 1 }
  ], {
    duration: motionMs(220),
    easing: "cubic-bezier(.2, .8, .2, 1)",
    fill: "both"
  });
}

async function fadeOutInspectCard(cardEl, ownerIndex = 0) {
  if (!cardEl?.isConnected) return;
  const driftY = ownerIndex === BOT_INDEX ? -28 : 28;
  const animation = cardEl.animate([
    { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)", offset: 0 },
    { opacity: 0, transform: `translate3d(0, ${driftY}px, 0) scale(.3)`, offset: 1 }
  ], {
    duration: motionMs(80),
    easing: "cubic-bezier(.2, .8, .2, 1)",
    fill: "forwards"
  });
  await animation.finished.catch(() => {});
}

async function revealPlayedCardOverlay(card, ownerIndex, sourceRect = null, options = {}) {
  document.querySelectorAll(".cardInspectGhost").forEach(cardEl => cardEl.classList.remove("cardInspectGhost"));
  inspectAnimation = null;
  inspectedLocalHandCardId = "";
  inspectedLocalBoardCardId = "";
  inspectedDiscardPileCardId = "";
  renderLocalHandActions();
  const cardEl = document.createElement("article");
  cardEl.className = `card inspectCard ${sourceRect ? "inspectCardPending" : ""}`;
  applyCardSprite(cardEl, card);
  cardEl.innerHTML = cardFaceHtml(card, cardPower(card, ownerIndex), cardKeywords(card, ownerIndex), "hand", ownerIndex, true);
  els.cardInspectContent.innerHTML = "";
  els.cardInspectContent.append(cardEl);
  positionCardInspectDialogAtBoard();
  if (!els.cardInspectDialog.open) els.cardInspectDialog.show();
  document.activeElement?.blur?.();
  if (sourceRect) {
    await afterNextPaint();
    const fromRect = normalizeCardTravelRect(sourceRect);
    const targetRect = normalizeCardTravelRect(cardEl.getBoundingClientRect());
    if (fromRect && targetRect) {
      const clone = await animateCardTravel(cardEl, fromRect, targetRect, {
        tilt: -3,
        tiltMode: "open",
        duration: 320
      });
      cardEl.classList.remove("inspectCardPending");
      clone.remove();
    } else {
      cardEl.classList.remove("inspectCardPending");
    }
  }
  await wait(motionMs(options.holdMs ?? BOT_PLAY_REVEAL_MS));
  await fadeOutInspectCard(cardEl, ownerIndex);
  els.cardInspectDialog.close();
}

async function showHyenixChoiceOverlay(card, ownerIndex, sourceRect = null) {
  document.querySelectorAll(".cardInspectGhost").forEach(cardEl => cardEl.classList.remove("cardInspectGhost"));
  inspectAnimation = null;
  inspectedLocalHandCardId = "";
  inspectedLocalBoardCardId = "";
  inspectedDiscardPileCardId = "";
  renderLocalHandActions();
  const cardEl = document.createElement("article");
  cardEl.className = `card inspectCard ${sourceRect ? "inspectCardPending" : ""}`;
  applyCardSprite(cardEl, card);
  cardEl.innerHTML = cardFaceHtml(card, cardPower(card, ownerIndex), cardKeywords(card, ownerIndex), "discard", ownerIndex, true);
  els.cardInspectContent.innerHTML = "";
  els.cardInspectContent.append(cardEl);
  positionCardInspectDialogAtBoard();
  if (!els.cardInspectDialog.open) els.cardInspectDialog.show();
  document.activeElement?.blur?.();
  if (!sourceRect) return;
  await afterNextPaint();
  const fromRect = normalizeCardTravelRect(sourceRect);
  const targetRect = normalizeCardTravelRect(cardEl.getBoundingClientRect());
  if (!fromRect || !targetRect) {
    cardEl.classList.remove("inspectCardPending");
    return;
  }
  const clone = await animateCardTravel(cardEl, fromRect, targetRect, {
    tilt: -3,
    tiltMode: "open",
    duration: 320
  });
  cardEl.classList.remove("inspectCardPending");
  clone.remove();
}

async function closeHyenixChoiceOverlay(ownerIndex) {
  const cardEl = els.cardInspectContent?.querySelector(".inspectCard");
  await fadeOutInspectCard(cardEl, ownerIndex);
  els.cardInspectDialog?.close();
  if (els.cardInspectContent) els.cardInspectContent.innerHTML = "";
}

function measureDiscardPileCardRect(playerIndex) {
  const pile = document.querySelector(`[data-discard-player="${playerIndex}"]`);
  const card = pile?.querySelector(".discardTopCard");
  return (card ?? pile)?.getBoundingClientRect?.() ?? null;
}

async function revealHyenixFromDiscard(card, ownerIndex, sourceRect = null) {
  if (!card) return;
  playSoundEffect("ability");
  setOpponentAbilityMessage(card, displayAbility(card));
  await revealPlayedCardOverlay(card, ownerIndex, sourceRect ?? measureDiscardPileCardRect(ownerIndex), {
    holdMs: HYENIX_REVEAL_HOLD_MS
  });
}

function closeInspectDialogInstant() {
  if (!els.cardInspectDialog?.open) return;
  document.querySelectorAll(".cardInspectGhost").forEach(cardEl => cardEl.classList.remove("cardInspectGhost"));
  inspectAnimation = null;
  inspectedLocalHandCardId = "";
  inspectedLocalBoardCardId = "";
  inspectedDiscardPileCardId = "";
  els.cardInspectContent.innerHTML = "";
  renderLocalHandActions();
  els.cardInspectDialog.close();
}

async function closeInspectDialogWithFade() {
  if (!els.cardInspectDialog.open) return;
  const animation = inspectAnimation;
  if (animation?.closing) return;
  if (animation) animation.closing = true;
  els.cardInspectContent.querySelector(".cardActions")?.classList.add("cardActionsClosing");
  await fadeOutInspectCard(animation?.targetEl ?? els.cardInspectContent.querySelector(".inspectCard"), animation?.ownerIndex);
  inspectAnimation = null;
  inspectedLocalHandCardId = "";
  inspectedLocalBoardCardId = "";
  inspectedDiscardPileCardId = "";
  renderLocalHandActions();
  if (animation) clearCardAnimationState(CARD_ANIMATION_STATE.INSPECT_CLOSING, animation.cardId);
  els.cardInspectDialog.close();
}

async function closeInspectDialogWithAnimation() {
  if (!els.cardInspectDialog.open) return;
  const animation = inspectAnimation;
  if (animation?.closing) return;
  if (!animation) {
    document.querySelectorAll(".cardInspectGhost").forEach(cardEl => cardEl.classList.remove("cardInspectGhost"));
    inspectedLocalHandCardId = "";
    inspectedLocalBoardCardId = "";
    inspectedDiscardPileCardId = "";
    renderLocalHandActions();
    els.cardInspectDialog.close();
    return;
  }
  animation.closing = true;
  setCardAnimationState(CARD_ANIMATION_STATE.INSPECT_CLOSING, animation.cardId, { zone: animation.zone });
  const targetEl = animation.targetEl;
  els.cardInspectContent.querySelector(".cardActions")?.classList.add("cardActionsClosing");
  const fromRect = normalizeCardTravelRect(targetEl?.getBoundingClientRect());
  const originRect = animation.originEl?.isConnected
    ? normalizeCardTravelRect(animation.originEl.getBoundingClientRect())
    : animation.originRect;
  if (animation.zone === "board") {
    await fadeOutInspectCard(targetEl, animation.ownerIndex);
  } else {
    targetEl?.classList.add("inspectCardPending");
  }
  if (animation.zone !== "board" && fromRect && originRect) {
    const clone = await animateCardTravel(targetEl, fromRect, originRect, {
      overshoot: false,
      fadeOutEarly: animation.zone === "hand",
      tilt: cardTravelTilt(animation.originEl),
      tiltMode: "close"
    });
    clone.remove();
  }
  if (animation.zone === "hand") {
    animation.originEl?.classList.remove("cardInspectGhost");
    playHandReturnBounce(animation.originEl);
  }
  inspectAnimation = null;
  inspectedLocalHandCardId = "";
  inspectedLocalBoardCardId = "";
  inspectedDiscardPileCardId = "";
  renderLocalHandActions();
  clearCardAnimationState(CARD_ANIMATION_STATE.INSPECT_CLOSING, animation.cardId);
  els.cardInspectDialog.close();
}

function askChoice({ title, text, options, context = null }) {
  return new Promise(resolve => {
    choiceDepth += 1;
    activeChoicePreviousPhase = state.phase;
    state.phase = "choice";
    choicePromptActorIndex = Number.isInteger(context?.actorIndex) ? context.actorIndex : null;
    activeChoicePromptContext = context;
    activeChoicePromptResolve = resolve;
    render();
    const botContext = { ...context, options };
    if (!duelModeActive && botContext.actorIndex === BOT_INDEX) {
      window.setTimeout(() => {
        choiceDepth -= 1;
        choicePromptActorIndex = null;
        activeChoicePromptContext = null;
        activeChoicePromptResolve = null;
        activeChoicePreviousPhase = null;
        if (!choiceDepth && !hasWinner()) state.phase = "action";
        clearRemoteMessageForAction();
        resolve(bot.chooseOption(botContext, state, botHelpers()) ?? options[0]?.value ?? "");
      }, bot.delay);
      return;
    }
    els.choiceDialog.classList.toggle("surrenderChoiceDialog", context?.type === "surrender");
    els.choiceTitle.textContent = title;
    els.choiceText.textContent = text;
    renderChoiceCardPreview(botContext);
    els.choiceOptions.innerHTML = "";
    for (const option of options) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = option.label;
      button.addEventListener("click", () => {
        finishActiveChoicePrompt(option.value);
      });
      els.choiceOptions.append(button);
    }
    els.choiceDialog.showModal();
  });
}

function finishActiveChoicePrompt(value) {
  const resolve = activeChoicePromptResolve;
  const context = activeChoicePromptContext;
  const previousPhase = activeChoicePreviousPhase;
  if (!resolve) return;
  activeChoicePromptResolve = null;
  activeChoicePromptContext = null;
  activeChoicePreviousPhase = null;
  if (els.choiceDialog?.open) els.choiceDialog.close();
  els.choiceDialog?.classList.remove("surrenderChoiceDialog");
  choiceDepth -= 1;
  choicePromptActorIndex = null;
  if (!choiceDepth && !hasWinner()) {
    state.phase = context?.preservePhase ? previousPhase : "action";
  }
  clearRemoteMessageForAction();
  resolve(value);
}

function pickCard(cards, title, allowSkip = false, context = {}) {
  const options = cards.map(card => ({
    label: `${displayCardName(card)} (${card.basePower})`,
    value: card.id
  }));
  if (allowSkip) options.unshift({ label: "Bỏ qua", value: "" });
  return askChoice({
    title,
    text: "Chọn một mục tiêu.",
    options,
    context: { type: "pick", ...context, cards }
  });
}

async function chooseLocalBlocker(blockers, attacker, attackerIndex, defenderIndex, isFrenzySecondAttack = false) {
  const decision = await waitForBlockPrompt(blockers, attacker, attackerIndex, defenderIndex, isFrenzySecondAttack);
  state.active = attackerIndex;
  if (decision !== "block") return "";
  return pickBlockerFromBoard(blockers, attackerIndex, defenderIndex);
}

function waitForBlockPrompt(blockers, attacker, attackerIndex, defenderIndex, isFrenzySecondAttack = false) {
  return new Promise(resolve => {
    choiceDepth += 1;
    state.phase = "choice";
    state.active = attackerIndex;
    blockPrompt = { blockers, attacker, attackerIndex, defenderIndex, isFrenzySecondAttack, resolve };
    showRemoteMessage(
      "Chặn?",
      "",
      { sticky: true }
    );
    render();
  });
}

function resolveBlockPrompt(value) {
  if (!blockPrompt) return;
  const pending = blockPrompt;
  blockPrompt = null;
  choiceDepth -= 1;
  state.active = pending.attackerIndex;
  if (!choiceDepth && !hasWinner()) state.phase = "action";
  clearRemoteMessage();
  render();
  pending.resolve(value);
}

function waitForHunterAttackPrompt(attacker, attackerIndex, defenderIndex) {
  return new Promise(resolve => {
    choiceDepth += 1;
    state.phase = "choice";
    state.active = attackerIndex;
    hunterAttackPrompt = { attacker, actorIndex: attackerIndex, defenderIndex, resolve };
    showRemoteMessage(
      "Trực tiếp/Quái vật",
      "",
      { sticky: true }
    );
    render();
  });
}

function resolveHunterAttackPrompt(value) {
  if (!hunterAttackPrompt) return;
  const pending = hunterAttackPrompt;
  hunterAttackPrompt = null;
  choiceDepth -= 1;
  state.active = pending.actorIndex;
  if (!choiceDepth && !hasWinner()) state.phase = "action";
  clearRemoteMessage();
  render();
  pending.resolve(value);
}

async function waitForFrenzySecondAttack(attacker, attackerIndex) {
  return new Promise(resolve => {
    choiceDepth += 1;
    state.phase = "choice";
    state.active = attackerIndex;
    frenzySecondAttackPrompt = { attacker, actorIndex: attackerIndex, ready: false, resolve };
    showRemoteMessage(
      "Đánh tiếp",
      "",
      { sticky: true }
    );
    enterAttackIntent(attacker.id, attackerIndex).then(() => {
      if (frenzySecondAttackPrompt?.attacker.id === attacker.id) {
        frenzySecondAttackPrompt.ready = true;
        render();
      }
    });
  });
}

function resolveFrenzySecondAttackPrompt(value) {
  if (!frenzySecondAttackPrompt) return;
  const pending = frenzySecondAttackPrompt;
  frenzySecondAttackPrompt = null;
  choiceDepth -= 1;
  state.active = pending.actorIndex;
  clearRemoteMessage();
  if (!choiceDepth && !hasWinner()) state.phase = "action";
  render();
  pending.resolve(value);
}

function pickHunterTargetFromBoard(candidates, actorIndex, targetOwnerIndex, attacker) {
  return new Promise(resolve => {
    choiceDepth += 1;
    state.phase = "choice";
    state.active = actorIndex;
    hunterTargetSelection = {
      actorIndex,
      ownerIndex: targetOwnerIndex,
      attacker,
      cardIds: new Set(candidates.map(card => card.id)),
      resolve
    };
    showRemoteMessage(
      "Chọn Quái vật",
      "",
      { sticky: true }
    );
    render();
  });
}

function finishHunterTargetSelection(cardId) {
  if (!hunterTargetSelection || !hunterTargetSelection.cardIds.has(cardId)) return;
  const resolve = hunterTargetSelection.resolve;
  const actorIndex = hunterTargetSelection.actorIndex;
  const target = state.players[hunterTargetSelection.ownerIndex].board.find(card => card.id === cardId);
  if (target) trackDebugTargetCard(cardId, displayCardName(target));
  hunterTargetSelection = null;
  choiceDepth -= 1;
  state.active = actorIndex;
  clearRemoteMessage();
  if (!choiceDepth && !hasWinner()) state.phase = "action";
  render();
  resolve(cardId);
}

function pickBlockerFromBoard(blockers, attackerIndex, defenderIndex) {
  return new Promise(resolve => {
    choiceDepth += 1;
    state.phase = "choice";
    state.active = attackerIndex;
    inspectedLocalBoardCardId = "";
    blockSelection = {
      turnOwnerIndex: attackerIndex,
      ownerIndex: defenderIndex,
      cardIds: new Set(blockers.map(card => card.id)),
      resolve
    };
    render();
  });
}

function finishBlockSelection(cardId) {
  if (!blockSelection || (cardId && !blockSelection.cardIds.has(cardId))) return;
  const resolve = blockSelection.resolve;
  const turnOwnerIndex = blockSelection.turnOwnerIndex;
  const blocker = state.players[blockSelection.ownerIndex].board.find(card => card.id === cardId);
  if (cardId) trackDebugTargetCard(cardId, blocker ? displayCardName(blocker) : "Blocker");
  blockSelection = null;
  inspectedLocalBoardCardId = "";
  choiceDepth -= 1;
  state.active = turnOwnerIndex;
  if (!choiceDepth && !hasWinner()) state.phase = "action";
  render();
  resolve(cardId);
}

async function chooseCreatureToDefeat(targetOwnerIndex, actorIndex, sourceCard) {
  const turnOwnerIndex = state.active;
  const candidates = state.players[targetOwnerIndex].board;
  if (!candidates.length) {
    log(`${sourceCard.name}: không có Quái vật đối thủ để hạ.`);
    return;
  }

  showRemoteMessage("Chọn Quái vật để giết", "", { sticky: actorIndex === 0 });
  const pickedId = actorIndex === 0
    ? await pickDefeatTargetFromBoard(candidates, turnOwnerIndex, targetOwnerIndex, sourceCard, actorIndex)
    : await askChoice({
      title: "Hạ Quái vật",
      text: `${displayCardName(sourceCard)}: chọn 1 Quái vật đối thủ để hạ.`,
      options: candidates.map(card => ({ label: `${displayCardName(card)} (${cardPower(card, targetOwnerIndex)})`, value: card.id })),
      context: { type: "defeat", actorIndex, ownerIndex: targetOwnerIndex, cards: candidates, sourceCard }
    });

  if (pickedId) {
    log(`${sourceCard.name} phát nổ và hạ ${state.players[targetOwnerIndex].board.find(card => card.id === pickedId)?.name ?? "mục tiêu"}.`);
    await defeatCreature(pickedId, targetOwnerIndex);
  }
}

function pickDefeatTargetFromBoard(candidates, turnOwnerIndex, targetOwnerIndex, sourceCard, actorIndex = turnOwnerIndex) {
  return new Promise(resolve => {
    choiceDepth += 1;
    state.phase = "choice";
    state.active = actorIndex;
    inspectedLocalBoardCardId = "";
    defeatSelection = {
      turnOwnerIndex,
      actorIndex,
      ownerIndex: targetOwnerIndex,
      sourceCard,
      cardIds: new Set(candidates.map(card => card.id)),
      resolve
    };
    render();
  });
}

function finishDefeatSelection(cardId) {
  if (!defeatSelection || !defeatSelection.cardIds.has(cardId)) return;
  const resolve = defeatSelection.resolve;
  const turnOwnerIndex = defeatSelection.turnOwnerIndex;
  defeatSelection = null;
  inspectedLocalBoardCardId = "";
  choiceDepth -= 1;
  state.active = turnOwnerIndex;
  clearRemoteMessage();
  if (!choiceDepth && !hasWinner()) state.phase = "action";
  render();
  resolve(cardId);
}

function renderChoiceCardPreview(context) {
  els.choiceCardPreview.innerHTML = "";
  if (!["mindbug", "received-card"].includes(context.type) || !context.card) {
    els.choiceCardPreview.hidden = true;
    return;
  }
  const ownerIndex = Number.isInteger(context.ownerIndex) ? context.ownerIndex : 1 - context.actorIndex;
  const card = context.card;
  const preview = document.createElement("article");
  preview.className = "card choicePreviewCard";
  applyCardSprite(preview, card);
  preview.innerHTML = cardFaceHtml(card, cardPower(card, ownerIndex), cardKeywords(card, ownerIndex), "hand", ownerIndex);
  els.choiceCardPreview.append(preview);
  els.choiceCardPreview.hidden = false;
}

function scheduleBotTurn() {
  if (duelModeActive) return;
  if (hasWinner() || state.active !== BOT_INDEX || state.phase !== "action") return;
  window.setTimeout(runBotTurn, bot.delay);
}

async function runBotTurn() {
  if (duelModeActive) return;
  if (hasWinner() || state.active !== BOT_INDEX || state.phase !== "action") return;
  const helpers = botHelpers();
  if (state.frenzyOnly) {
    await attack(state.frenzyOnly);
    return;
  }
  const captainForcedAttackers = captainHippoForcedAttackers(BOT_INDEX);
  if (captainForcedAttackers.length) {
    await attack(randomItem(captainForcedAttackers).id);
    return;
  }
  const action = bot.chooseTurnAction(state, helpers);
  if (action.type === "attack") {
    await attack(action.cardId);
  } else if (action.type === "action") {
    await useEvolutionAction(action.cardId, BOT_INDEX);
  } else if (action.type === "play") {
    await playCard(action.cardId);
  } else {
    await waitAfterBotAction(BOT_INDEX);
    endTurn();
  }
}

function botHelpers() {
  return {
    creatureAbilitiesEnabled: CREATURE_ABILITIES_ENABLED,
    cardPower,
    cardKeywords,
    canAttack,
    canUseEvolutionAction,
    legalBlockers,
    directDamage,
    canDealDirectDamage
  };
}

function directDamage(card) {
  if (!CREATURE_ABILITIES_ENABLED || animationTestMode) return 1;
  if (card.name === "World Eater") return 2;
  return card.name === "Chameleon Sniper" ? 2 : 1;
}

function canDealDirectDamage(card, attackerIndex, defenderIndex) {
  if (animationTestMode) return legalBlockers(card, attackerIndex, defenderIndex).length === 0;
  if (CREATURE_ABILITIES_ENABLED && card.name === "Chameleon Sniper") return true;
  if (CREATURE_ABILITIES_ENABLED && card.name === "World Eater") return true;
  if (CREATURE_ABILITIES_ENABLED && card.name === "Turbo Bug" && state.players[defenderIndex].life > 1) return true;
  return legalBlockers(card, attackerIndex, defenderIndex).length === 0;
}

function localHandCardAtPoint(x, y) {
  const cardEl = document.elementsFromPoint(x, y)
    .map(element => element.closest?.("#hand .card"))
    .find(Boolean);
  if (!cardEl) return null;
  const cardId = cardEl.dataset.cardId;
  const card = state.players[0].hand.find(handCard => handCard.id === cardId);
  return card ? { card, cardEl } : null;
}

function startHandScrubGesture(event) {
  if (!state || hasWinner() || event.pointerType === "mouse" && event.button !== 0) return;
  const hit = localHandCardAtPoint(event.clientX, event.clientY);
  if (!hit) return;
  window.clearTimeout(handScrubGesture?.timer);
  handScrubGesture = {
    active: false,
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY,
    currentCardId: "",
    timer: window.setTimeout(() => activateHandScrubGesture(), 280)
  };
}

function activateHandScrubGesture() {
  if (!handScrubGesture || handScrubGesture.active) return;
  const hit = localHandCardAtPoint(handScrubGesture.clientX, handScrubGesture.clientY);
  if (!hit) {
    endHandScrubGesture();
    return;
  }
  handScrubGesture.active = true;
  handScrubGesture.currentCardId = hit.card.id;
  suppressNextInspectClick = true;
  inspectCard(hit.card, 0, "hand", hit.cardEl);
}

function updateHandScrubGesture(event) {
  if (!handScrubGesture || event.pointerId !== handScrubGesture.pointerId) return;
  handScrubGesture.clientX = event.clientX;
  handScrubGesture.clientY = event.clientY;
  if (!handScrubGesture.active) return;
  const hit = localHandCardAtPoint(event.clientX, event.clientY);
  if (!hit || hit.card.id === handScrubGesture.currentCardId) return;
  handScrubGesture.currentCardId = hit.card.id;
  suppressNextInspectClick = true;
  showInspectCardImmediately(hit.card, 0, "hand", hit.cardEl);
}

function endHandScrubGesture(event = null) {
  if (!handScrubGesture) return;
  if (event && event.pointerId !== handScrubGesture.pointerId) return;
  const wasActive = handScrubGesture.active;
  window.clearTimeout(handScrubGesture.timer);
  handScrubGesture = null;
  if (!wasActive) return;
  suppressNextInspectClick = true;
  window.setTimeout(() => {
    suppressNextInspectClick = false;
  }, 250);
}

els.newGameBtn?.addEventListener("click", newGame);
els.gameOverLobby?.addEventListener("click", returnToLobby);
els.gameOverNewGame?.addEventListener("click", requestNewGame);
els.gameSettingsButton?.addEventListener("click", showGameSettings);
els.gameSettingsCloseButton?.addEventListener("click", hideGameSettings);
els.gameSettingsNewGameButton?.addEventListener("click", confirmNewGameFromSettings);
els.gameSettingsLobbyButton?.addEventListener("click", confirmReturnToLobby);
els.gameSettingsOverlay?.addEventListener("click", event => {
  if (event.target === els.gameSettingsOverlay) hideGameSettings();
});
els.gameConfirmCancelButton?.addEventListener("click", hideGameConfirm);
els.gameConfirmAcceptButton?.addEventListener("click", acceptGameConfirm);
els.gameConfirmOverlay?.addEventListener("click", event => {
  if (event.target === els.gameConfirmOverlay) hideGameConfirm();
});
els.lobbyProfileChip?.addEventListener("click", showProfileOverlay);
els.lobbySettingsButton?.addEventListener("click", showLobbySettings);
els.lobbySettingsCloseButton?.addEventListener("click", hideLobbySettings);
els.lobbySettingsOverlay?.addEventListener("click", event => {
  if (event.target === els.lobbySettingsOverlay) hideLobbySettings();
});
for (const slider of [els.lobbySfxVolumeSlider, els.gameSfxVolumeSlider]) {
  slider?.addEventListener("input", event => handleSfxVolumeInput(event));
  slider?.addEventListener("change", event => handleSfxVolumeInput(event, { preview: true }));
}
syncSfxVolumeControls();
els.lobbyProfileContinueButton?.addEventListener("click", finishLobbyProfile);
els.lobbyProfileCloseButton?.addEventListener("click", hideProfileOverlay);
els.lobbyStartButton?.addEventListener("click", startGameFromLobby);
els.lobbyModeSolo?.addEventListener("click", () => setLobbyMode("solo"));
els.lobbyModeDuel?.addEventListener("click", () => setLobbyMode("duel"));
els.lobbyBackButton?.addEventListener("click", showLobbyModes);
els.lobbyDuelBackButton?.addEventListener("click", showLobbyModes);
els.lobbyCreateRoomButton?.addEventListener("click", createDuelRoom);
els.lobbyJoinRoomButton?.addEventListener("click", joinDuelRoom);
els.lobbyWaitingBackButton?.addEventListener("click", () => {
  leaveDuelRoom();
});
els.lobbyRoomStartButton?.addEventListener("click", startDuelFromWaitingRoom);
els.lobbyPlayerName?.addEventListener("input", () => {
  const clippedName = String(els.lobbyPlayerName.value || "").slice(0, 8);
  if (els.lobbyPlayerName.value !== clippedName) els.lobbyPlayerName.value = clippedName;
  localPlayerName = clippedName.trim() || "Bạn";
  updateLobbyProfileChip();
  if (lobbyProfileReady) saveLobbyProfile();
  emitDuelProfileUpdate();
});
els.lobbyPlayerName?.addEventListener("focus", prepareProfileNameInput);
els.lobbyPlayerName?.addEventListener("blur", restoreProfileNamePlaceholder);
els.lobbyRoomCodeInput?.addEventListener("input", () => {
  const code = String(els.lobbyRoomCodeInput.value || "").replace(/\D/g, "").slice(0, 4);
  if (els.lobbyRoomCodeInput.value !== code) els.lobbyRoomCodeInput.value = code;
  updateJoinRoomButtonState();
});

document.addEventListener("visibilitychange", () => {
  if (!duelModeActive || !lobbyRoom?.online || !duelSocket?.connected) return;
  duelSocket.emit(document.hidden ? "player-away" : "player-active");
});

window.addEventListener("pagehide", () => {
  if (duelModeActive && lobbyRoom?.online && duelSocket?.connected) {
    duelSocket.emit("player-away");
  }
});
document.querySelectorAll("[data-bot-difficulty]").forEach(button => {
  button.addEventListener("click", () => setBotDifficulty(button.dataset.botDifficulty));
});
els.rulesBtn?.addEventListener("click", () => els.rulesDialog.showModal());
els.debugAnimationMode?.addEventListener("click", () => {
  animationTestMode = !animationTestMode;
  log(`Animation test mode: ${animationTestMode ? "ON" : "OFF"}.`);
  render();
});
els.debugAddP1?.addEventListener("click", () => debugAddCreatureToBoard(0));
els.debugAddP2?.addEventListener("click", () => debugAddCreatureToBoard(1));
els.debugAddNamedP1?.addEventListener("click", () => {
  debugAddNamedCardToBoard(0);
});
els.debugAddNamedP2?.addEventListener("click", () => {
  debugAddNamedCardToBoard(1);
});
els.debugCardSearch?.addEventListener("keydown", event => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  debugAddNamedCardToBoard(0);
});
els.debugDrawP1?.addEventListener("click", () => debugDrawToHand(0));
els.debugDrawP2?.addEventListener("click", () => debugDrawToHand(1));
els.debugPlayerAttack?.addEventListener("click", () => debugPlayerRandomAttack());
els.debugBotAttack?.addEventListener("click", () => debugBotRandomAttack());
document.querySelectorAll(".debugKeywordButton").forEach(button => {
  button.addEventListener("click", () => {
    const playerIndex = Number.parseInt(button.dataset.debugPlayer ?? "", 10);
    const keyword = button.dataset.debugKeyword ?? "";
    if (!Number.isInteger(playerIndex) || !keyword) return;
    debugAddKeywordCreatureToBoard(playerIndex, keyword);
  });
});
els.discardDialogClose?.addEventListener("click", () => closeDiscardDialog());
els.discardBackdrop?.addEventListener("click", () => closeDiscardDialog());
els.discardDialog?.addEventListener("close", () => {
  if (els.discardBackdrop) els.discardBackdrop.hidden = true;
  if (discardPileSelection) {
    window.requestAnimationFrame(() => {
      if (discardPileSelection) openDiscardDialog(discardPileSelection.ownerIndex);
    });
  }
});
els.cardInspectClose?.addEventListener("click", () => closeInspectDialogWithAnimation());
els.cardInspectDialog.addEventListener("click", event => {
  if (receivedCardOverlay || hyenixChoicePrompt) return;
  if (event.target === els.cardInspectDialog) closeInspectDialogWithAnimation();
});
els.cardInspectDialog.addEventListener("cancel", event => {
  event.preventDefault();
  if (receivedCardOverlay || hyenixChoicePrompt) return;
  closeInspectDialogWithAnimation();
});
document.addEventListener("pointerdown", event => {
  unlockAudio();
  if (event.pointerType === "mouse" && event.button !== 0) return;
  const target = event.target.closest?.("button:not(:disabled)");
  if (!target) return;
  playSoundEffect("click");
  target.classList.remove("pressBounce");
  // Force style recalc so repeated taps restart the bounce.
  void target.offsetWidth;
  target.classList.add("pressBounce");
  window.setTimeout(() => target.classList.remove("pressBounce"), motionMs(190));
}, true);
document.addEventListener("keydown", () => unlockAudio(), true);
document.addEventListener("pointerdown", event => {
  if (!els.discardDialog?.open) return;
  if (els.discardDialog.contains(event.target)) return;
  if (els.cardInspectDialog?.open && els.cardInspectDialog.contains(event.target)) return;
  if (els.localHandActions?.contains(event.target)) return;
  closeDiscardDialog();
}, true);
document.addEventListener("pointerdown", event => {
  if (!els.cardInspectDialog.open) return;
  if (receivedCardOverlay || hyenixChoicePrompt) return;
  if (els.cardInspectDialog.contains(event.target)) return;
  if (els.localHandActions?.contains(event.target)) return;
  suppressNextInspectClick = true;
  window.setTimeout(() => {
    suppressNextInspectClick = false;
  }, 250);
  event.preventDefault();
  event.stopPropagation();
  closeInspectDialogWithAnimation();
}, true);
document.addEventListener("click", event => {
  if (!suppressNextInspectClick) return;
  suppressNextInspectClick = false;
  event.preventDefault();
  event.stopPropagation();
}, true);
els.hand?.addEventListener("pointerdown", startHandScrubGesture);
window.addEventListener("pointermove", event => {
  pointerPosition = { x: event.clientX, y: event.clientY };
  updateHandScrubGesture(event);
  if (debugOpen) renderDebugPointer();
});
window.addEventListener("pointerup", event => endHandScrubGesture(event));
window.addEventListener("pointercancel", event => endHandScrubGesture(event));
window.addEventListener("resize", syncAppScale);
window.visualViewport?.addEventListener("resize", syncAppScale);
window.visualViewport?.addEventListener("scroll", syncAppScale);
document.addEventListener("focusin", event => {
  if (!event.target.matches?.("input, textarea, [contenteditable='true']")) return;
  window.clearTimeout(viewportScaleUnlockTimer);
  viewportScaleLockedForKeyboard = true;
});
document.addEventListener("focusout", event => {
  if (!event.target.matches?.("input, textarea, [contenteditable='true']")) return;
  window.clearTimeout(viewportScaleUnlockTimer);
  viewportScaleUnlockTimer = window.setTimeout(() => {
    const activeElement = document.activeElement;
    if (activeElement?.matches?.("input, textarea, [contenteditable='true']")) return;
    viewportScaleLockedForKeyboard = false;
    syncAppScale();
  }, 420);
});
window.addEventListener("keydown", event => {
  if (!event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key.toLowerCase();
  if (key === "d") {
    event.preventDefault();
    debugOpen = !debugOpen;
    renderDebugPanel();
    return;
  }
  if (key === "e") {
    event.preventDefault();
    requestNewGame();
  }
});

syncAppScale();
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => {
    const serviceWorkerUrl = new URL(`${import.meta.env.BASE_URL}sw.js`, location.href);
    navigator.serviceWorker.register(serviceWorkerUrl, { scope: import.meta.env.BASE_URL }).catch(error => {
      console.warn("Không đăng ký được chế độ ứng dụng.", error);
    });
  });
}
loadVietnameseCardText().finally(async () => {
  await calibrateMotionDelta();
  await hydrateBotLearningFromFile();
  renderLobby();
  if (savedDuelRoomCode()) {
    connectDuelSocket().catch(() => {
      setLobbyDuelStatus("Không thể khôi phục phòng online.");
    });
  }
  window.setTimeout(() => {
    ensureGameAssetsPreloaded({ showLobbyStatus: true }).catch(() => {});
  }, 60);
});
