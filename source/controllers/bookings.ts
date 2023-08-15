import { Request, Response, NextFunction } from "express";
import prisma from "../prisma";
import dayjs from "dayjs";
import { CURRENT_DATE } from "../constants/Date";

interface BookingDto {
  guestName: string;
  unitID: string;
  checkInDate: Date;
  numberOfNights: number;
}

interface UpdateBookingDto {
  unitID: string;
  numberOfNights: number;
}

const healthCheck = async (req: Request, res: Response, next: NextFunction) => {
  return res.status(200).json({
    message: "OK",
  });
};

const createBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const booking: BookingDto = req.body;

  let outcome = await isBookingPossible(booking);
  if (!outcome.result) {
    return res.status(400).json(outcome.reason);
  }

  let bookingResult = await prisma.booking.create({
    data: {
      guestName: booking.guestName,
      unitID: booking.unitID,
      checkInDate: new Date(booking.checkInDate),
      numberOfNights: booking.numberOfNights,
      checkOutDate: dayjs(booking.checkInDate)
        .add(booking.numberOfNights, "day")
        .toDate(),
    },
  });

  return res.status(200).json(bookingResult);
};

type BookingOutcome = { result: boolean; reason: string };

async function isBookingPossible(booking: BookingDto): Promise<BookingOutcome> {
  if (dayjs(booking.checkInDate).isBefore(CURRENT_DATE)) {
    return { result: false, reason: "You cannot Unit a room in the past" };
  }

  // check 1 : The Same guest cannot book the same unit multiple times
  let sameGuestSameUnit = await prisma.booking.findMany({
    where: {
      AND: {
        guestName: {
          equals: booking.guestName,
        },
        unitID: {
          equals: booking.unitID,
        },
      },
    },
  });
  if (sameGuestSameUnit.length > 0) {
    return {
      result: false,
      reason: "The given guest name cannot book the same unit multiple times",
    };
  }

  // check 2 : the same guest cannot be in multiple units at the same time
  let sameGuestAlreadyBooked = await prisma.booking.findMany({
    where: {
      guestName: {
        equals: booking.guestName,
      },
    },
  });
  if (sameGuestAlreadyBooked.length > 0) {
    return {
      result: false,
      reason: "The same guest cannot be in multiple units at the same time",
    };
  }

  const myCheckOutDate = dayjs(booking.checkInDate)
    .add(booking.numberOfNights, "day")
    .toDate();

  // check 3 : Unit is available for the check-in date
  let isUnitAvailableOnCheckInDate = await prisma.booking.findMany({
    where: {
      unitID: {
        equals: booking.unitID,
      },
      AND: [
        {
          OR: [
            {
              checkInDate: {
                lte: new Date(booking.checkInDate),
                gte: new Date(booking.checkInDate),
              },
            },
            {
              checkOutDate: {
                lte: new Date(booking.checkInDate),
                gte: new Date(booking.checkInDate),
              },
            },
            {
              checkInDate: {
                lte: new Date(booking.checkInDate),
              },
              checkOutDate: {
                gte: new Date(booking.checkInDate),
              },
            },
          ],
        },
        {
          OR: [
            {
              checkInDate: {
                lte: myCheckOutDate,
                gte: new Date(booking.checkInDate),
              },
            },
            {
              checkOutDate: {
                lte: myCheckOutDate,
                gte: new Date(booking.checkInDate),
              },
            },
            {
              checkInDate: {
                lte: new Date(booking.checkInDate),
              },
              checkOutDate: {
                gte: myCheckOutDate,
              },
            },
          ],
        },
      ],
    },
  });

  if (isUnitAvailableOnCheckInDate.length > 0) {
    return {
      result: false,
      reason: `For the given check-in date, the unit is already occupied`,
    };
  }

  return { result: true, reason: "OK" };
}

const updateBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const updateBooking: UpdateBookingDto = req.body;
  const { id } = req.params;

  let outcome = await isUpdateBookingPossible(updateBooking, parseInt(id, 10));
  if (!outcome.result) {
    return res.status(400).json(outcome.reason);
  }

  return res.status(200).json();
};

const isUpdateBookingPossible = async (
  updateBooking: UpdateBookingDto,
  id: number
): Promise<BookingOutcome> => {
  // find unique booking to update if possible
  const booking = await prisma.booking.findUnique({
    where: {
      id,
    },
  });

  //check if booking exit with given id
  if (!booking || booking.id !== id) {
    return {
      result: false,
      reason: `User do not exists.`,
    };
  }

  // calculate new checkout Date
  const myNewCheckoutDate = dayjs(booking.checkInDate)
    .add(booking.numberOfNights, "day")
    .add(updateBooking.numberOfNights, "day")
    .toDate();

  //Check if unit is available for extension
  let overlappingBookings = await prisma.booking.findFirst({
    where: {
      unitID: booking.unitID,
      AND: [
        {
          OR: [
            {
              checkInDate: {
                lte: myNewCheckoutDate,
                gte: new Date(booking.checkInDate),
              },
            },
            {
              checkOutDate: {
                lte: myNewCheckoutDate,
                gte: new Date(booking.checkInDate),
              },
            },
            {
              checkInDate: {
                lte: new Date(booking.checkInDate),
              },
              checkOutDate: {
                gte: myNewCheckoutDate,
              },
            },
            {
              checkInDate: {
                lte: new Date(booking.checkInDate),
              },
              checkOutDate: {
                gte: new Date(booking.checkOutDate),
              },
            },
            {
              checkInDate: {
                equals: new Date(booking.checkInDate),
              },
            },
            {
              checkOutDate: {
                equals: new Date(booking.checkOutDate),
              },
            },
          ],
        },
        {
          NOT: {
            id: booking.id,
          },
        },
      ],
    },
  });

  if (overlappingBookings) {
    return {
      result: false,
      reason: `Can not extend stay period, because this unit is already booked!`,
    };
  }

  // if available, update current booking
  await prisma.booking.update({
    where: {
      id,
    },
    data: {
      checkOutDate: myNewCheckoutDate,
      numberOfNights: booking.numberOfNights + updateBooking.numberOfNights,
    },
  });

  return { result: true, reason: "OK" };
};

export default { healthCheck, createBooking, updateBooking };
