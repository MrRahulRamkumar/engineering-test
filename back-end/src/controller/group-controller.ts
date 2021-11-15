import { NextFunction, Request, Response } from "express"
import { createQueryBuilder, getRepository } from "typeorm"
import { Group } from "../entity/group.entity"
import { Roll } from "../entity/roll.entity"
import { GroupStudent } from "../entity/group-student.entity"
import { StudentRollState } from "../entity/student-roll-state.entity"
import { CreateGroupInput, UpdateGroupInput } from "../interface/group.interface"
import { getStartEndDates, getRollStatesConditionString } from "../util"
import { CreateGroupStudentInput } from "../interface/group-student.interface"
import { Student } from "../entity/student.entity"
import { QueryResult } from "../interface/query-result.interface"

export class GroupController {
  private studentRepository = getRepository(Student)
  private groupRepository = getRepository(Group)
  private groupStudentRepository = getRepository(GroupStudent)
  private studentRollStateRepository = getRepository(StudentRollState)

  async allGroups(request: Request, response: Response, next: NextFunction) {
    // Task 1:
    // Return the list of all groups
    return this.groupRepository.find()
  }

  async createGroup(request: Request, response: Response, next: NextFunction) {
    // Task 1:
    // Add a Group
    const { body: params } = request

    const createGroupInput: CreateGroupInput = {
      name: params.name,
      number_of_weeks: params.number_of_weeks,
      roll_states: params.roll_states,
      incidents: params.incidents,
      ltmt: params.ltmt,
    }

    const group = new Group()
    group.prepareToCreate(createGroupInput)
    return this.groupRepository.save(group)
  }

  async updateGroup(request: Request, response: Response, next: NextFunction) {
    // Task 1:
    // Update a Group
    const { body: params } = request

    let groupToUpdate = await this.groupRepository.findOne(params.id)

    const updateGroupInput: UpdateGroupInput = {
      id: params.id,
      name: params.name,
      number_of_weeks: params.number_of_weeks,
      roll_states: params.roll_states,
      incidents: params.incidents,
      ltmt: params.ltmt,
      run_at: params.run_at,
      student_count: params.student_count,
    }

    if (groupToUpdate !== undefined) {
      groupToUpdate.prepareToUpdate(updateGroupInput)
      return this.groupRepository.save(updateGroupInput)
    } else {
      response.status(404).send("Group not found")
    }
  }

  async removeGroup(request: Request, response: Response, next: NextFunction) {
    // Task 1:
    // Delete a Group
    let groupToRemove = await this.groupRepository.findOne(request.params.id)
    if (groupToRemove !== undefined) {
      return this.groupRepository.remove(groupToRemove)
    } else {
      response.status(404).send("Group not found")
    }
  }

  async getGroupStudents(request: Request, response: Response, next: NextFunction) {
    // Task 1:
    // Return the list of Students that are in a Group

    /*
    SELECT *
    FROM  student
          INNER JOIN group_student ON student.id = group_student.student_id
    WHERE  group_student.group_id = 1  
    */
    const studentsInGroup = await this.studentRepository
      .createQueryBuilder("student")
      .innerJoin(GroupStudent, "group_student", "student.id = group_student.student_id")
      .where("group_student.group_id = :id", { id: request.params.id })
      .getMany()

    return studentsInGroup
  }

  private async addToGroupStudent(id: number, queryResult: QueryResult[]) {
    queryResult.forEach(async (student: QueryResult) => {
      const createGroupStudentInput: CreateGroupStudentInput = {
        group_id: id,
        student_id: student.student_id,
        incident_count: student.incident_count,
      }

      const groupStudent = new GroupStudent()
      groupStudent.prepareToCreate(createGroupStudentInput)
      await this.groupStudentRepository.save(groupStudent)
    })
  }

  private async updateMetadata(id: number, studentCount: number) {
    // updates the metadata fields in group table
    await this.groupRepository.save({
      id: id,
      run_at: new Date(),
      student_count: studentCount,
    })
  }

  async runGroupFilters(request: Request, response: Response, next: NextFunction) {
    // Task 2:
    // 1. Clear out the groups (delete all the students from the groups)
    // 2. For each group, query the student rolls to see which students match the filter for the group
    // 3. Add the list of students that match the filter to the group

    await this.groupStudentRepository.clear()

    let allGroups = await this.groupRepository.find()
    allGroups.forEach(async (group) => {
      /*
      SELECT student_id,
             Count(student_id) AS incident_count
      FROM   student_roll_state
             INNER JOIN roll ON student_roll_state.roll_id = roll.id
      WHERE  roll.id = student_roll_state.roll_id
            AND completed_at BETWEEN '2021-10-31' AND '2021-11-14'
            AND (state = 'late' or state = 'absent')
      GROUP  BY student_id
      HAVING incident_count > 3  
      */

      // query result will contain the student id and the number of incidents that student has matched with the current group

      const { startDate, endDate } = getStartEndDates(group.number_of_weeks)
      const conditionString = getRollStatesConditionString(group.roll_states)

      let queryResult: QueryResult[] = await this.studentRollStateRepository
        .createQueryBuilder("student_roll_state")
        .select("student_id")
        .addSelect("COUNT(student_roll_state.student_id) AS incident_count")
        .innerJoin(Roll, "roll", "student_roll_state.roll_id = roll.id")
        .where("roll.completed_at BETWEEN :startDate AND :endDate", { startDate, endDate })
        .andWhere(conditionString)
        .groupBy("student_roll_state.student_id")
        .having(`incident_count ${group.ltmt} :incidents`, { incidents: group.incidents })
        .getRawMany()

      console.log(group.id)
      console.log(queryResult)
      console.log()

      // adding the result of the query to the group_student table
      await this.addToGroupStudent(group.id, queryResult)

      // updating the meta data fields in the group table for the current group. student count is length of the query result
      await this.updateMetadata(group.id, queryResult.length)
    })
    response.send("Group filters finished running")
  }
}
