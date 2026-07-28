TẠO GAME VỚI NỘI DUNG NHƯ SAU:

Mindbug là game đấu bài dành cho 2 người, với mục tiêu làm đối thủ mất hết 3 điểm máu (Life).
Mỗi người bắt đầu với 10 Creature Cards (5 lá trên tay, 5 lá làm chồng bài rút), 2 Mindbug và 3 Life.
Trong lượt của mình, người chơi chỉ được thực hiện một trong hai hành động:
    - Chơi một Creature hoặc tấn công bằng một Creature đang có trên sân. Khi một Creature được chơi, đối thủ có thể sử dụng một Mindbug để cướp quyền điều khiển lá bài đó trước khi hiệu ứng Play được kích hoạt. Nếu điều này xảy ra, Creature sẽ chuyển sang sân đối thủ, đối thủ nhận toàn bộ hiệu ứng của lá bài, còn người chơi bị cướp sẽ được thực hiện ngay một lượt khác. Nếu đối thủ không dùng Mindbug, Creature sẽ vào sân của người chơi như bình thường và kích hoạt Play hoặc Constant ABILITY.
    - Khi chọn tấn công, người phòng thủ có thể dùng một Creature để chặn; hai Creature sẽ giao chiến và Creature với Power thấp hơn bị tiêu diệt. Nếu không chặn, người phòng thủ sẽ mất 1 Life. Các KEYWORD, Play, Defeated ABILITY được xử lý ở đây. Sau mỗi lần chơi Creature, người chơi rút bài để duy trì 5 lá trên tay cho đến khi chồng bài rút hết.

Một Deck gồm 48 lá bài, được liệt kê trong file creature-list.md

Mỗi Creature có các thuộc tính như sau:
- Tên
- Số lượng Creature đó trong deck: ghi sau tên, phân tách bằng dấu ":"
- Power: một số nguyên
- KEYWORD: Viết hoa, gồm 1-2 trong 5 loại sau:
    - FRENZY: After the creature's first attack during a turn, it may choose (if it is still in play) to attack a second time this turn
    - HUNTER: when you attack with a HUNTER monster, instead of the opponent, you may choose an enemy creature (your opponent does not have a block decision). You are allowed to choose a creature that would otherwise be unable to block this attack. Using the HUNTER ability is voluntary, but if you do, you cannot use it to attack the opponent directly.
    - POISONOUS: In addition to normal combat resolution, this creature always defeated the enemy creature, even if its Power value is less than the enemy's power value. If the enemy creature's Power value is equal or higher, the poisonous creature is also defeated.
    - SNEAKY: This creature can only be blocked by SNEAKY creatures. It still can block enemy creatures like a normal monster.
    - TOUGH: This monster has 2 HP, each time it is attacked, reduce its HP by 1. When it has no HP left, it is defeated.
- ABILITY: Mỗi Creature có một unique ABILITY, thuộc 1 trong 4 loại sau: Play/ Constant/ Attack/ Defeated. Play ABILITY kích hoạt khi Creature đó được chơi (được triệu hồi lên sân bởi việc triệu hồi thông thường hoặc khi bị Mind Bug); nếu Play ABILITY yêu cầu đối thủ bỏ bài như Ferret Bomber, đối thủ chọn bài từ tay và bỏ từng lá trước khi game tiếp tục. Constant ABILITY kích hoạt kể từ khi Creature đó vào sân và kết thúc khi Creature đó rời sân. Attack ABILITY kích hoạt khi Creature ở trong lượt của mình và tấn công; nếu Attack ABILITY yêu cầu đối thủ chọn bài từ tay để bỏ như Tusked Exporter, đối thủ chọn và bỏ bài đó trước khi game tiếp tục xử lý combat. Defeated ABILITY kích hoạt khi Creature bị defeated; ví dụ Harpy Mother chỉ chiếm quyền điều khiển tối đa 2 Creature sức mạnh 5 trở xuống sau khi chính Harpy Mother bị defeated. Với Explosive Toad, người điều khiển nó chọn 1 Creature trên sân đối thủ để hạ khi Explosive Toad bị defeated.

Tạm thời cần tạo rule cho ABILITY
