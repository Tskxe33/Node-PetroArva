/*
  Warnings:

  - Made the column `checkOutDate` on table `Booking` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Booking" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guestName" TEXT NOT NULL,
    "unitID" TEXT NOT NULL,
    "checkInDate" DATETIME NOT NULL,
    "checkOutDate" DATETIME NOT NULL,
    "numberOfNights" INTEGER NOT NULL
);
INSERT INTO "new_Booking" ("checkInDate", "checkOutDate", "guestName", "id", "numberOfNights", "unitID") SELECT "checkInDate", "checkOutDate", "guestName", "id", "numberOfNights", "unitID" FROM "Booking";
DROP TABLE "Booking";
ALTER TABLE "new_Booking" RENAME TO "Booking";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

UPDATE Booking
SET checkOutDate = DATETIME(checkInDate, '+' || numberOfNights || ' days');

-- Drop the old table and rename the new table
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE new_Booking AS SELECT * FROM Booking;
DROP TABLE Booking;
ALTER TABLE new_Booking RENAME TO Booking;
COMMIT;
PRAGMA foreign_keys=ON;